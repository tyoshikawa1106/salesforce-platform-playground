/** 元ユーザーの無効化、新規作成、選択した権限付与を一括で行う画面の入口 */
public with sharing class UserCreateAssistantController {
    // 役割と項目に応じたコピー条件を共通化
    private static UserCreateAssistantService service = new UserCreateAssistantService();
    // 取得はすべて実行者の参照権限に限定
    private static UserCreateAssistantSelector selector = new UserCreateAssistantSelector();

    /**
     * コピー元の現在値と画面で利用可能な入力条件を取得
     * @param sourceId 選択したコピー元ユーザー
     * @return 標準項目とカスタム項目の定義・値・表示名
     */
    @AuraEnabled
    public static UserCreateAssistantWrapper getForm(Id sourceId) {
        // 選択元の情報を取得できない場合は画面向けの案内にする
        try {
            // 利用者権限から表示項目を確定
            UserCreateAssistantFieldCatalog catalog = new UserCreateAssistantFieldCatalog();
            // 表示順と各項目の区分を同時に確定
            Map<String,String> groups = catalog.getFieldGroups();
            // 読み取り可能な参照先の表示名も照会
            List<String> columns = service.getQueryFields(catalog.orderedNames);
            // 選択した本人だけの情報を取得
            List<User> sources = selector.getUsers(sourceId, columns);
            // 型ごとの入力条件と表示値を生成
            UserCreateAssistantWrapper form = service.createForm(groups, catalog.orderedNames, sources);
            // 完成したフォームを返す
            return form;
        } catch (AuraHandledException e) {
            // 入力を修正できる案内は保持
            throw e;
        } catch (Exception e) {
            // SOQL や個人情報を利用者に表示しない
            throw new AuraHandledException('ユーザー情報を取得できません。参照権限を確認して選び直してください。');
        }
    }

    /**
     * コピー元の編集・無効化、新規ユーザー作成と任意の権限割り当てをまとめて保存
     * @param request コピー元と操作別のチェック状態、変更項目の JSON
     * @return 保存に成功した新規ユーザー ID
     */
    @AuraEnabled
    public static Id saveUser(UserCreateAssistantWrapper request) {
        // 未指定の操作は保存開始前に拒否
        if (request == null) {
            throw new AuraHandledException('保存するユーザー情報を指定してください。');
        }
        // コピー元の変更も含め全操作を一括で取り消せる境界を確保
        Savepoint beforeSave = Database.setSavepoint();
        // 入力・作成・権限割り当てのどの段階で修正が必要かを識別
        String stage = 'input';
        // 割り当てを選択した場合だけ設定オブジェクトを参照
        Boolean assignAccess = request.copyPermissionSets == true || request.copyPermissionSetGroups == true;
        // 選択したどの種類の権限が失敗したかをエラー行で判定
        List<PermissionSetAssignment> grants = new List<PermissionSetAssignment>();
        // 保存に失敗した場合は元ユーザーを含む全件を戻す
        try {
            // 元ユーザーの最新の固定項目を取得
            List<User> sources = selector.getSourceForSave(request.sourceId);
            // 固定値と入力された値を持つ新規ユーザーを生成
            User target = prepareActiveTarget(sources, request.targetValuesJson);
            // 無効化前に割り当ての状態を保存
            List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
            // 引き継ぎを選択した場合だけ元ユーザーの割り当てを取得
            if (assignAccess) {
                stage = 'grant';
                assignments = selector.getAssignments(request.sourceId);
            }
            // 明示的に選択した場合にのみコピー元を変更
            if (request.deactivateSource == true) {
                // コピー元の入力と権限を再確認してから無効化
                stage = 'source';
                // 元ユーザーの他の値は更新対象に含めない
                User original = service.prepareUser(sources, request.sourceValuesJson, UserCreateAssistantFieldInput.Side.SOURCE);
                // 元のユーザー名や利用枠を空けてからユーザーを作成
                update as user original;
            } else {
                // 参照専用時は元ユーザーの更新要求を拒否
                new UserCreateAssistantFieldInput().checkSourceUnchanged(request.sourceValuesJson);
            }
            // ライセンスと必須入力を Salesforce 側でも確認
            stage = 'target';
            // 固定値を含むユーザーを実行者権限で作成
            insert as user target;
            // 引き継げる割り当てが存在する場合だけ新規ユーザーの自動付与と照合
            if (!assignments.isEmpty()) {
                stage = 'grant';
                // 自動付与等による重複を検出
                List<PermissionSetAssignment> existing = selector.getAssignments(target.Id);
                // 権限セットとグループの期限付き割り当てを用意
                request.targetId = target.Id;
                // 期限と二重割り当てを確認
                grants = service.createAssignments(request, assignments, existing);
                // いずれかに失敗すると全処理を取り消す
                insert as user grants;
            }
            // 権限付与まで成功した新規ユーザーだけに標準のリセット通知を要求
            stage = 'email';
            sendResetEmailIfRequested(target.Id, request.sendResetEmail);
            // すべての設定が成功したユーザーだけを通知
            return target.Id;
        } catch (Exception e) {
            // 設定ライセンス不足の場合も元ユーザーを確実に復元
            Database.rollback(beforeSave);
            // エラー対象を特定できる範囲で利用者向けに変換
            throw getSaveError(e, stage, grants);
        }
    }

    private static User prepareActiveTarget(List<User> sources, String targetValuesJson) {
        User target = service.prepareUser(sources, targetValuesJson, UserCreateAssistantFieldInput.Side.TARGET);
        // 無効での作成を要求する旧画面からは、元ユーザーに変更を加える前に戻す
        if (target.IsActive != true) {
            throw new AuraHandledException('新規ユーザーは有効で作成します。画面を開き直してください。');
        }
        return target;
    }

    private static void sendResetEmailIfRequested(Id createdUserId, Boolean requested) {
        // 作成要求に通知の指定がない場合も通常どおり完了する
        if (requested == true) {
            System.resetPassword(createdUserId, true);
        }
    }

    private static AuraHandledException getSaveError(Exception e, String stage, List<PermissionSetAssignment> grants) {
        // 安全な検証メッセージはそのまま返却
        if (e instanceof AuraHandledException) {
            return (AuraHandledException)e;
        }
        if (stage == 'email') {
            return new AuraHandledException('パスワードリセットメールの送信を要求できませんでした。送信権限・組織のメール設定を確認してください。ユーザー作成は取り消しました。');
        }
        // 権限付与の失敗では解除して再試行する対象を示す
        if (stage == 'grant') {
            // エラー行の情報からどちらのチェックを外すか判定
            String kind = getGrantKind(e, grants);
            // 入力を保持したまま権限付与だけを外して再試行可能
            return new AuraHandledException(kind + ' の引き継ぎに失敗しました。必要なライセンスと割り当て権限を確認するか、該当する引き継ぎをオフにしてください。');
        }
        // Salesforce の内部メッセージを公開せず原因を分類
        if (e instanceof DmlException) {
            return getUserDmlError((DmlException)e, stage);
        }
        // 入力の型違いと権限による拒否から復帰できる案内
        return new AuraHandledException('保存できません。項目の入力形式とユーザーの管理権限を確認してください。');
    }

    private static String getGrantKind(Exception e, List<PermissionSetAssignment> grants) {
        // 特定の行を識別できない取得・権限エラー
        if (!(e instanceof DmlException) || ((DmlException)e).getNumDml() == 0) {
            return '権限セットまたは権限セットグループ';
        }
        // エラー情報に対応する割り当てを確認
        Integer index = ((DmlException)e).getDmlIndex(0);
        // 不明な行を誤認しない
        if (index < 0 || index >= grants.size()) {
            return '権限セットまたは権限セットグループ';
        }
        // 個人情報を含めず権限の種類のみを返却
        return grants[index].PermissionSetGroupId == null ? '権限セット' : '権限セットグループ';
    }

    private static AuraHandledException getUserDmlError(DmlException e, String stage) {
        // コピー元の変更失敗と新規ユーザーの登録失敗を区別
        String action = stage == 'source' ? 'コピー元を更新できません。' : '新規ユーザーを作成できません。';
        // エラー文に含まれるユーザー名・メール・IDは公開しない
        String code = String.valueOf(e.getDmlType(0));
        // ユーザーライセンスの枠不足は権限引き継ぎの解除では解消しない
        if (code.contains('LICENSE')) {
            return new AuraHandledException(action + '利用可能なユーザーライセンス数を確認してください。');
        }
        // 無効化だけではユーザー名の一意制約を解除できない
        if (code == 'DUPLICATE_USERNAME') {
            String side = stage == 'source' ? 'コピー元ユーザー' : '新規ユーザー';
            return new AuraHandledException('このユーザー名はすでに使われています。「' + side + '」の「ユーザー名」に別の未使用の値を入力してください。');
        }
        // 他の一意項目の重複も入力内容から修正できるよう案内
        if (code.contains('DUPLICATE')) {
            return new AuraHandledException(action + 'ニックネームなど、一意である必要がある項目の重複を確認してください。');
        }
        // 組織の入力規則に違反した項目はユーザーが変更して再試行
        if (code == 'FIELD_CUSTOM_VALIDATION_EXCEPTION') {
            return new AuraHandledException(action + '組織の入力規則を確認してください。ユーザー名の変更が制限されている場合は、新規側に別のユーザー名を入力してください。');
        }
        // 無効化の制約や入力・権限による拒否を知らせる
        return new AuraHandledException(action + '入力値、管理権限、ユーザーの利用条件を確認してください。');
    }
}
