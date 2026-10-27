/** オブジェクト構造探索と項目分類の参照・保存の入口 */
public with sharing class ObjectExplorerController {

    private ObjectExplorerFieldService fieldService = new ObjectExplorerFieldService();
    private ObjectExplorerService structureService = new ObjectExplorerService();
    private ObjectExplorerClassificationService classificationService = new ObjectExplorerClassificationService();
    private ObjectExplorerSelector selector = new ObjectExplorerSelector();
    private MetadataApiIntegrationClient client = new MetadataApiIntegrationClient();
    private ObjectExplorerOwnerService ownerService = new ObjectExplorerOwnerService();
    private ObjectExplorerOwnerService.CsvOwners csvOwners = new ObjectExplorerOwnerService.CsvOwners();
    private ObjectExplorerAccessPolicy access = new ObjectExplorerAccessPolicy();
    private ObjectExplorerAccessPolicy.RequestValidator requests = new ObjectExplorerAccessPolicy.RequestValidator();
    private ObjectExplorerClassificationService.Preparation preparation = new ObjectExplorerClassificationService.Preparation();
    private ObjectExplorerClassificationService.SaveResults results = new ObjectExplorerClassificationService.SaveResults();

    /**
     * 分類一覧と組織の分類候補を取得
     * @param objectName Describeで検証する対象
     * @return 項目API名をキーとする分類情報
     */
    @AuraEnabled
    public static String getClassifications(String objectName) {
        // 公開入口から取得順序を持つ同じControllerへ委譲
        ObjectExplorerController controller = new ObjectExplorerController();
        // 検証済みの一覧だけをシリアライズ
        Map<String, Object> data = controller.readClassificationView(objectName);
        // 内部状態を公開せず画面用の値だけを返却
        return JSON.serialize(data);
    }

    /**
     * 最大10項目の分類をまとめて反映し、同じ対象を再取得
     * @param objectName 対象オブジェクト
     * @param changesJson 基準値と編集値を含む変更行
     * @return 成功・失敗・再取得状態
     */
    @AuraEnabled
    public static String saveClassifications(String objectName, String changesJson) {
        // 公開入口では要求ごとに処理状態を分離
        ObjectExplorerController controller = new ObjectExplorerController();
        // 入力を解釈する前に実効権限を確認
        controller.requireEditAccess();
        // 要求の形式と件数を更新前に確定
        List<Object> changes = controller.requests.parseChanges(changesJson);
        // 保存対象と結果の順序を同じ処理で管理
        List<Object> results = controller.saveFields(objectName, changes);
        // 確認済みの結果だけを画面へ返却
        return JSON.serialize(results);
    }

    /**
     * 分類の所有者候補をユーザー・公開グループから検索
     * @param term 所有者の表示名検索語
     * @return 所有者候補のJSON
     */
    @AuraEnabled
    public static String searchClassificationOwners(String term) {
        // 所有者の検索も分類変更を許可された利用者に限定
        ObjectExplorerController controller = new ObjectExplorerController();
        // UIの有効状態に依存せず実効権限を確認
        controller.requireEditAccess();
        // 検索語の未入力を候補全体の検索へ揃える
        String searchTerm = term == null ? '' : term.trim();
        // 所有者候補は現在の利用者が参照可能な範囲から取得
        List<User> users = controller.selector.selectUsers(searchTerm);
        // 公開グループも同じ検索条件で取得
        List<Group> groups = controller.selector.selectGroups(searchTerm);
        // 候補への変換は同じ所有者のIDと表示名を扱うServiceへ委譲
        List<Object> rows = controller.ownerService.createOwnerChoices(users, groups);
        // 検索結果だけを画面へ返却
        return JSON.serialize(rows);
    }

    /**
     * CSVの所有者IDを可視なユーザー・公開グループへ照合
     * @param idsJson 18桁の所有者ID配列
     * @return 同じIDの候補だけを含むJSON
     */
    @AuraEnabled
    public static String resolveClassificationOwners(String idsJson) {
        // 通常の分類編集と同じ権限境界を使用
        ObjectExplorerController controller = new ObjectExplorerController();
        // CSV経由でもカスタマイズ権限を必須にする
        controller.requireEditAccess();
        // 表示名や識別名をIDとして検索しない
        Set<Id> ids = controller.csvOwners.parseIds(idsJson);
        // 同じID集合から可視ユーザーを取得
        List<User> users = controller.selector.selectOwnerUsers(ids);
        // 公開グループ以外は候補に含めない
        List<Group> groups = controller.selector.selectOwnerGroups(ids);
        // 返却するID・表示名・有効状態は同じ実レコードから生成
        Map<String, Object> owners = controller.csvOwners.createChoices(users, groups);
        // この入口では分類の更新もMetadata API呼出しも行わない
        return JSON.serialize(owners);
    }

    /**
     * 一覧に必要な分類・所有者・選択肢を取得して組み立て
     * @param objectName Describeで検証する対象
     * @return 可視な分類と組織の選択肢
     */
    private Map<String, Object> readClassificationView(String objectName) {
        // 一覧にも機能の利用権限を適用
        this.access.requireAccess();
        // 保存と共通のオブジェクト参照条件を適用
        Schema.SObjectType objectType = this.access.requireObject(objectName);
        // 正式名で同じオブジェクトの分類を取得
        String canonicalName = objectType.getDescribe(SObjectDescribeOptions.DEFERRED).getName();
        // 一覧はネイティブ項目定義から取得
        List<FieldDefinition> records = this.selector.selectFields(canonicalName);
        // 所有者は項目単位で取得しない
        Set<Id> ownerIds = this.fieldService.collectOwnerIds(records);
        // 表示名に必要なユーザーをまとめて取得
        List<User> users = this.selector.selectOwnerUsers(ownerIds);
        // 公開グループも同じ所有者集合を使用
        List<Group> groups = this.selector.selectOwnerGroups(ownerIds);
        // 表示ラベルは同じレコードのIDへ対応付け
        Map<Id, String> ownerLabels = this.ownerService.createOwnerLabels(users, groups);
        // 分類の表示と編集可否を同じ対象から生成
        Map<String, Object> rows = this.fieldService.createRows(records, objectType, ownerLabels);
        // 選択肢の値とラベルは組織定義を使用
        Map<String, Object> options = this.access.getOptions();
        // 画面に必要な一覧と候補だけを公開
        return new Map<String, Object>{'rows' => rows, 'options' => options};
    }

    /**
     * 最新値の取得・項目別更新・再取得の順序を管理
     * @param objectName 対象オブジェクト
     * @param changes 形式と件数を確認済みの保存要求
     * @return 入力と同じ順番の保存結果
     */
    private List<Object> saveFields(String objectName, List<Object> changes) {
        // 表記揺れをDescribeの正式名へ統一
        Schema.SObjectType objectType = this.access.requireObject(objectName);
        // 全更新対象で同じオブジェクトのDescribeを共用
        Schema.DescribeSObjectResult info = objectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        // API要求には確認済みの正式名だけを使用
        String canonicalName = info.getName();
        // 業務入力の確認は通信開始より前に完了
        List<ObjectExplorerClassificationService.FieldContext> contexts = this.requests.createFieldContexts(info, changes);
        // 一括問い合わせの対象を同じ項目から生成
        Set<String> names = this.classificationService.getFieldNames(contexts);
        // 定義はSelectorから未加工で取得
        List<FieldDefinition> definitions = this.selector.selectFieldsByNames(canonicalName, names);
        // 完全な項目識別子との照合はServiceへ委譲
        contexts = this.requests.bindDefinitions(contexts, definitions);
        try {
            // 認証先と更新対象組織の一致を要求単位で確認
            this.client.verifyOrganization();
            // 保存前の分類を別API要求で一括取得
            Map<String, Map<String, Object>> rows = this.client.readClassifications(canonicalName, names);
            // 所有者は現在値と選択値をまとめて取得
            Map<Id, SObject> owners = readOwners(rows, changes);
            // 項目ごとの事前確認失敗を分離
            contexts = prepareFields(contexts, rows, owners);
            // 検証済みの変更だけを各通信方式で送信
            contexts = updateFields(contexts);
            // 確定済みの拒否を維持して保存値を確認
            contexts = verifyFields(canonicalName, contexts);
        } catch (Exception error) {
            // 通信全体の失敗でも確定した項目別結果を維持
            contexts = this.results.failPendingFields(contexts, error);
        }
        // 結果の順序と確定状態をServiceで確認
        List<Object> results = this.results.createSaveResults(contexts);
        // 名前付きの結果から公開契約へ返却
        return results;
    }

    /**
     * 最新所有者と編集で選択した所有者を一括取得
     * @param rows APIの最新分類
     * @param changes 保存要求、再取得時は空リスト
     * @return 同じ所有者IDの実レコードの索引
     */
    private Map<Id, SObject> readOwners(Map<String, Map<String, Object>> rows, List<Object> changes) {
        // 表示名から逆引きせず要求内のIDだけを使用
        Set<Id> ids = this.ownerService.collectRequestedOwnerIds(rows, changes);
        // 取得結果の型を維持してServiceへ渡す
        List<User> users = this.selector.selectOwnerUsers(ids);
        // 公開グループも同じID集合で取得
        List<Group> groups = this.selector.selectOwnerGroups(ids);
        // 呼び出し間で所有者の古いキャッシュを共有しない
        Map<Id, SObject> owners = this.ownerService.createOwnerIndex(users, groups);
        // 次段には同じIDの索引だけを渡す
        return owners;
    }

    /**
     * 項目ごとの最新値を確認し必要なカスタム定義を取得
     * @param contexts 保存対象
     * @param rows 最新分類の索引
     * @param owners IDで照合済みの所有者
     * @return 項目別の確認結果
     */
    private List<ObjectExplorerClassificationService.FieldContext> prepareFields(List<ObjectExplorerClassificationService.FieldContext> contexts, Map<String, Map<String, Object>> rows, Map<Id, SObject> owners) {
        // 取得前の入力を変更せず次段の状態を生成
        List<ObjectExplorerClassificationService.FieldContext> prepared = new List<ObjectExplorerClassificationService.FieldContext>();
        // 一項目の失敗で他の入力を破棄しない
        for (ObjectExplorerClassificationService.FieldContext source : contexts) {
            try {
                // 同じ項目の現在値と編集基準を照合
                ObjectExplorerClassificationService.FieldContext context = this.preparation.prepareField(source, rows.get(source.fieldName), owners);
                // カスタム定義だけは他属性を保持するため追加取得
                if (context.customField) {
                    // 通信はControllerの処理順序に残す
                    Map<String, Object> response = this.client.readCustomField(context.definition.DurableId);
                    // 定義の完全名と所有者を同じ対象へ照合
                    context = this.preparation.prepareCustomField(context, response);
                }
                // 確認した状態だけを更新段へ引き継ぐ
                prepared.add(context);
            } catch (Exception error) {
                // 事前確認の失敗は未送信のまま保持
                ObjectExplorerClassificationService.FieldContext failed = this.results.failField(source, error);
                // 入力順で同じ対象の失敗状態を追加
                prepared.add(failed);
            }
        }
        // 入力順を維持した確認結果を返す
        return prepared;
    }

    /**
     * 検証済みカスタム項目と標準項目の更新を実行
     * @param contexts 事前確認結果
     * @return 送信状態と個別拒否を反映した結果
     */
    private List<ObjectExplorerClassificationService.FieldContext> updateFields(List<ObjectExplorerClassificationService.FieldContext> contexts) {
        // カスタム更新の例外を一項目ずつ捕捉
        for (Integer index = 0; index < contexts.size(); index++) {
            // 更新要否はServiceが確定した結果を使用
            ObjectExplorerClassificationService.FieldContext context = contexts[index];
            // 標準項目と失敗済み・変更不要の項目は個別通信しない
            if (context.completed || context.original == context.expected || !context.customField) { continue; }
            // 送信後の確認不能と明示拒否を区別
            context.sent = true;
            try {
                // 分類以外を保持した定義だけを送信
                this.client.updateCustomField(context.definition.DurableId, context.metadata);
            } catch (Exception error) {
                // 元の入力順に同じ項目の失敗を保持
                contexts[index] = this.results.failField(context, error);
            }
        }
        // 個別更新後に標準項目だけをまとめて送信
        return updateStandardFields(contexts);
    }

    /**
     * 標準項目の一括更新と項目別の拒否を管理
     * @param contexts 事前確認とカスタム更新の結果
     * @return 標準項目の送信状態を反映した結果
     */
    private List<ObjectExplorerClassificationService.FieldContext> updateStandardFields(List<ObjectExplorerClassificationService.FieldContext> contexts) {
        // 標準項目はまとめて同じ要求へ送信
        Map<String, ObjectExplorerClassificationService.FieldContext> standard = this.results.selectStandardUpdates(contexts);
        // 変更がないときはSOAP要求を省略
        if (standard.isEmpty()) { return contexts; }
        // HTTPクライアントに渡す定義だけを抽出
        Map<String, Map<String, Object>> fields = new Map<String, Map<String, Object>>();
        // 完全名と送信した状態を同じ対象へ固定
        for (String name : standard.keySet()) {
            // 通信前に全標準対象の送信状態を確定
            standard.get(name).sent = true;
            // 応答順から対象を推測しない
            fields.put(name, standard.get(name).metadata);
        }
        try {
            // 接続クライアントで応答の件数と完全名を検証
            Map<String, String> results = this.client.updateStandardFields(fields);
            // 明示的に拒否された対象だけを失敗へ変更
            List<ObjectExplorerClassificationService.FieldContext> updated = this.results.applyStandardResults(contexts, results);
            // 結果照合済みの状態だけを次段へ渡す
            return updated;
        } catch (Exception error) {
            // カスタム項目の結果へ標準項目の通信失敗を混在させない
            for (Integer index = 0; index < contexts.size(); index++) {
                // 今回送信した標準項目だけを選択
                ObjectExplorerClassificationService.FieldContext context = contexts[index];
                // 確認済みの失敗やカスタム項目を保持
                if (!context.completed && context.original != context.expected && !context.customField) { contexts[index] = this.results.failField(context, error); }
            }
            // 未送信・確認待ちの対象は後続で照合
            return contexts;
        }
    }

    /**
     * 保存後の分類を別要求で取得して同じ項目へ照合
     * @param objectName 確認済み対象オブジェクト
     * @param contexts 保存対象
     * @return 保存後の確認結果
     */
    private List<ObjectExplorerClassificationService.FieldContext> verifyFields(String objectName, List<ObjectExplorerClassificationService.FieldContext> contexts) {
        // 個別拒否済みの対象を成功へ戻さない
        Set<String> names = this.results.getVerificationNames(contexts);
        // 全項目が失敗確定なら追加通信しない
        if (names.isEmpty()) { return contexts; }
        // ネイティブIDを含む最新分類を別APIで確認
        Map<String, Map<String, Object>> rows = this.client.readClassifications(objectName, names);
        // 保存後の所有者も新しいID集合で取得
        Map<Id, SObject> owners = readOwners(rows, new List<Object>());
        // 元の入力順で同じ対象だけを確認
        for (Integer index = 0; index < contexts.size(); index++) {
            // 確認済み項目の結果は上書きしない
            ObjectExplorerClassificationService.FieldContext context = contexts[index];
            // 再取得が不要な対象を除外
            if (context.completed) { continue; }
            try {
                // 値と所有者IDの両方が一致する場合だけ成功
                contexts[index] = this.preparation.verifyField(context, rows.get(context.fieldName), owners);
            } catch (Exception error) {
                // 更新後の不一致を同じ項目の確認不能として保持
                contexts[index] = this.results.failField(context, error);
            }
        }
        // 項目ごとの保存結果を返す
        return contexts;
    }

    /** 分類変更の入口で機能権限と標準権限を確認 */
    private void requireEditAccess() {
        // LWC用セットで公開した機能だけを実行
        this.access.requireAccess();
        // 現在ユーザーの標準権限を取得してから判定
        List<UserPermissionAccess> permissions = this.selector.selectCurrentPermissions();
        // 不明な権限を許可として扱わない
        this.access.requireCustomization(permissions);
    }

    /**
     * 参照可能なオブジェクトをラベルとAPI名で検索
     * @param term 部分一致の検索語
     * @param scope standard、customの検索範囲
     * @return 候補一覧のJSON
     */
    @AuraEnabled
    public static String searchObjects(String term, String scope) {
        // 公開入口のstaticを下位の業務処理へ持ち込まない
        ObjectExplorerController controller = new ObjectExplorerController();
        // 検索条件と参照可否を同じServiceで確認
        List<Map<String, Object>> rows = controller.structureService.searchObjects(term, scope);
        // 候補だけを画面へ返却
        return JSON.serialize(rows);
    }

    /**
     * カスタム項目の作成・最終更新情報を取得
     * @param objectName 選択中オブジェクトAPI名
     * @return 可視な項目API名ごとの日時とユーザー名
     */
    @AuraEnabled
    public static String getFieldAudit(String objectName) {
        // 日時専用Serviceとネイティブ定義を同じ要求で使用
        ObjectExplorerController controller = new ObjectExplorerController();
        // 構造探索と日時情報の対応付けを分離
        ObjectExplorerFieldService service = controller.fieldService;
        // 日時取得もオブジェクトの参照権限を照会前に確認
        Schema.SObjectType objectType = controller.access.requireObject(objectName);
        // 日時取得でも同じ要求のDescribeを後段へ渡す
        Schema.DescribeSObjectResult info = objectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        // Describeで確認済みの正式名だけを照会に使用
        String canonicalName = info.getName();
        // 項目識別子だけをまとめて取得
        List<FieldDefinition> definitions = controller.selector.selectFieldAuditTargets(canonicalName);
        // 可視なカスタム項目だけをIDへ対応付け
        Map<Id, String> targets = service.createAuditTargets(info, definitions);
        // URL長と取得件数を200件単位で制限
        List<Set<Id>> batches = service.createAuditBatches(targets.keySet());
        // REST通信は既存Clientを共有
        MetadataApiIntegrationClient client = new MetadataApiIntegrationClient();
        // カスタム項目がある場合だけ認証先組織を確認
        if (!batches.isEmpty()) { client.verifyOrganization(); }
        // 全バッチの取得結果を対応付け前に保持
        List<Map<String, Object>> records = new List<Map<String, Object>>();
        // 画面へ部分成功を返さず全件取得する
        for (Set<Id> batch : batches) {
            // 確認済みのID集合からクエリを生成
            String query = service.createAuditQuery(batch);
            // 接続先・認証・待ち時間は既存Clientの処理を共用
            Map<String, Object> response = client.request('tooling/query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'), 'GET', null);
            // 完了した応答だけを取り出す
            List<Map<String, Object>> batchRecords = service.readAuditRecords(response);
            // 後続のID検証に必要な元レコードを保持
            records.addAll(batchRecords);
        }
        // Userの参照可否を確認して人物IDをまとめる
        Set<Id> userIds = service.collectAuditUserIds(records);
        // 人物名とリンクには実行ユーザーの可視Userだけを使用
        List<User> users = controller.selector.selectAuditUsers(userIds);
        // 同じ項目の日時と可視な人物だけを表示モデルへ変換
        Map<String, Object> result = service.createAuditView(targets, records, users);
        // 検証済みの可視項目だけを返却
        return JSON.serialize(result);
    }

    /**
     * 起点の項目と直接の参照関係を取得
     * @param objectName Describeで検証する起点API名
     * @param mode referenceは関連探索を含め、classification・fieldsは項目のみ取得。nullはreference
     * @return オブジェクト概要・項目・関連のJSON
     */
    @AuraEnabled
    public static String getObjectInfo(String objectName, String mode) {
        // ServiceとSelectorを同じ要求内で使用
        ObjectExplorerController controller = new ObjectExplorerController();
        // オブジェクトと項目の参照可否をDescribeで検証
        Map<String, Object> data = controller.structureService.getObjectInfo(objectName, mode);
        // 項目ごとの通信を避けて型表記を一括取得
        List<EntityParticle> types = controller.selector.selectFieldTypes((String)data.get('apiName'));
        // API用の型と表示用の表記を分離
        Map<String, Object> result = controller.fieldService.createFieldTypeView(data, types);
        // 表示モデルだけを画面へ返却
        return JSON.serialize(result);
    }
}
