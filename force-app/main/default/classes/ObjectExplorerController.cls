/** オブジェクト構造探索と項目分類の参照・保存の入口 */
public with sharing class ObjectExplorerController {

    private ObjectExplorerFieldService fieldService = new ObjectExplorerFieldService();
    private ObjectExplorerService structureService = new ObjectExplorerService();
    private ObjectExplorerClassifyService classifyService = new ObjectExplorerClassifyService();
    private ObjectExplorerSelector selector = new ObjectExplorerSelector();
    private ObjectExplorerApiClient client = new ObjectExplorerApiClient();
    private ObjectExplorerOwnerService ownerService = new ObjectExplorerOwnerService();
    private ObjectExplorerOwnerService.CsvOwners csvOwners = new ObjectExplorerOwnerService.CsvOwners();
    private ObjectExplorerAccessPolicy access = new ObjectExplorerAccessPolicy();
    private ObjectExplorerAccessPolicy.RequestValidator requests = new ObjectExplorerAccessPolicy.RequestValidator();
    private ObjectExplorerClassifyService.Preparation preparation = new ObjectExplorerClassifyService.Preparation();
    private ObjectExplorerClassifyService.SaveResults results = new ObjectExplorerClassifyService.SaveResults();

    /** 実行ユーザーの認証状態を取得
     * @return 公開状態と固定案内
     */
    @AuraEnabled
    public static Map<String, Object> getApiAuthentication() {
        // 認証状態の表示契約を通信処理から分離
        ObjectExplorerAuthenticationService service = new ObjectExplorerAuthenticationService();
        try {
            // 本人のPer Userトークンと接続先組織を標準の通信境界で確認
            ConnectApi.CredentialAuthenticationStatus status = new SalesforceApiClient().getAuthenticationStatus();
            // 資格情報を含まない画面用状態へ変換
            Map<String, Object> state = service.createAuthenticationState(status);
            return state;
        } catch (Exception e) {
            // 明示的な認証拒否だけを再認証へ振り分け、内部例外は公開しない
            Map<String, Object> failure = service.createAuthenticationFailure(e);
            return failure;
        }
    }

    /** 標準API認証を開始するURLを取得
     * @return 現在組織の認証開始URL
     */
    @AuraEnabled
    public static String getApiAuthenticationUrl() {
        // 標準URLの取得順序を公開入口に残す
        String value = new SalesforceApiClient().getAuthenticationUrl();
        // 認証固有の接続先検証を同じServiceに集約
        ObjectExplorerAuthenticationService service = new ObjectExplorerAuthenticationService();
        String authenticationUrl = service.requireAuthenticationUrl(value);
        return authenticationUrl;
    }

    /** 実行ユーザー本人のAPI認証を解除 */
    @AuraEnabled
    public static void revokeApiAuthentication() {
        // 固定したPer User資格情報だけを通信境界で削除する
        new SalesforceApiClient().revokeAuthentication();
    }

    /**
     * 分類一覧と組織の分類候補を取得
     * @param objectName Describeで検証する対象
     * @return 項目API名をキーとする分類情報
     */
    @AuraEnabled
    public static Map<String, Object> getClassifyData(String objectName) {
        // 公開入口から取得順序を持つ同じControllerへ委譲
        ObjectExplorerController controller = new ObjectExplorerController();
        // 検証済みの一覧を構造化した応答として保持
        Map<String, Object> data = controller.readClassifyView(objectName);
        // 内部状態を公開せず画面用の値だけを返却
        return data;
    }

    /**
     * 最大10項目の分類をまとめて反映し、同じ対象を再取得
     * 呼び出し元は一連の保存開始時にgetApiAuthenticationで接続先組織を確認し、保存中は接続・認証設定を変更しない
     * @param objectName 対象オブジェクト
     * @param changesJson 基準値と編集値を含む変更行
     * @return 成功・失敗・再取得状態
     */
    @AuraEnabled
    public static List<Object> saveClassifyData(String objectName, String changesJson) {
        try {
            // 公開入口では要求ごとに処理状態を分離
            ObjectExplorerController controller = new ObjectExplorerController();
            // 入力を解釈する前に実効権限を確認
            controller.requireEditAccess();
            // 要求の形式と件数を更新前に確定
            List<Object> changes = controller.requests.parseChanges(changesJson);
            // 保存対象と結果の順序を同じ処理で管理
            List<Object> results = controller.saveFields(objectName, changes);
            // 確認済みの結果だけを画面へ返却
            return results;
        } catch (Exception error) {
            // 安全な業務理由だけを公開例外へ変換
            throw SalesforceApiProtocol.publicException(error, '保存要求の検証', ObjectExplorerAccessPolicy.errorPublication(error));
        }
    }

    /**
     * 分類の所有者候補をユーザー・公開グループから検索
     * @param term 所有者の氏名・メールアドレスまたは公開グループ名の前方一致検索語
     * @return 所有者候補の一覧
     */
    @AuraEnabled
    public static List<Object> searchClassifyOwners(String term) {
        // 所有者の検索も分類変更を許可された利用者に限定
        ObjectExplorerController controller = new ObjectExplorerController();
        // UIの有効状態に依存せず実効権限を確認
        controller.requireEditAccess();
        // 検索語の前後空白を除き、空欄はSelectorで照会しない
        String searchTerm = controller.ownerService.normalizeSearchTerm(term);
        // 所有者候補は現在の利用者が参照可能な範囲から取得
        List<User> users = controller.selector.selectUsers(searchTerm);
        // 公開グループも同じ検索条件で取得
        List<Group> groups = controller.selector.selectGroups(searchTerm);
        // 候補への変換は同じ所有者のIDと表示名を扱うServiceへ委譲
        List<Object> rows = controller.ownerService.createOwnerChoices(users, groups);
        // 検索結果だけを画面へ返却
        return rows;
    }

    /**
     * CSVの所有者IDを可視なユーザー・公開グループへ照合
     * @param idsJson 18桁の所有者ID配列
     * @return 同じIDの候補だけを含む索引
     */
    @AuraEnabled
    public static Map<String, Object> resolveClassifyOwners(String idsJson) {
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
        return owners;
    }

    /**
     * 一覧に必要な分類・所有者・選択肢を取得して組み立て
     * @param objectName Describeで検証する対象
     * @return 可視な分類と組織の選択肢
     */
    private Map<String, Object> readClassifyView(String objectName) {
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
        List<ObjectExplorerClassifyService.FieldContext> contexts = this.requests.createFieldContexts(info, changes);
        // 一括問い合わせの対象を同じ項目から生成
        Set<String> names = this.classifyService.getFieldNames(contexts);
        // 定義はSelectorから未加工で取得
        List<FieldDefinition> definitions = this.selector.selectFieldsByNames(canonicalName, names);
        // 完全な項目識別子との照合はServiceへ委譲
        contexts = this.requests.bindDefinitions(contexts, definitions);
        // 項目別失敗にもAPI要求の段階を残す
        String stage = '保存前の分類取得';
        try {
            // 保存開始時の接続確認後、各バッチでは取得済みの分類を照合
            // 同じ項目定義を分類照合へ渡し重複したAPI照会を省略
            Map<String, Map<String, Object>> rows = new ObjectExplorerApiProtocol.RecordReader().createFieldRows(definitions);
            // 所有者は現在値と選択値をまとめて取得
            stage = '所有者の参照';
            // 同じ要求の所有者を実行ユーザーの権限で取得
            Map<Id, SObject> owners = readOwners(rows, changes);
            // 項目ごとの事前確認失敗を分離
            stage = '更新前の確認';
            // 現在値と編集基準を照合
            contexts = this.preparation.prepareFields(contexts, rows, owners);
            // 変更するカスタム項目の定義をまとめて照合
            contexts = prepareCustomFields(contexts);
            // 検証済みの変更だけを各通信方式で送信
            stage = '分類の更新';
            // 項目ごとの成功と拒否を保持
            contexts = updateFields(contexts);
            // 確定済みの拒否を維持して保存値を確認
            stage = '保存結果の再取得・照合';
            // 更新の受付だけで成功とせず保存値まで確認
            contexts = verifyFields(canonicalName, contexts);
        } catch (Exception error) {
            // 通信全体の失敗でも確定した項目別結果を維持
            Exception failure = error;
            // 共通クライアントの固定メッセージだけに段階を付加
            if (error instanceof SalesforceApiClient.IntegrationException) { failure = new SalesforceApiClient.IntegrationException(stage + '：' + error.getMessage()); }
            // 想定外の例外本文はSaveResults側で固定文へ置換
            contexts = this.results.failPendingFields(contexts, failure);
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
     * 変更するカスタム項目の定義だけをまとめて取得し照合
     * @param contexts 入力と競合を確認済みの状態
     * @return 個別の読取・照合結果を反映した状態
     */
    private List<ObjectExplorerClassifyService.FieldContext> prepareCustomFields(List<ObjectExplorerClassifyService.FieldContext> contexts) {
        Map<String, Integer> indexes = this.results.getCustomReadIndexes(contexts);
        if (indexes.isEmpty()) { return contexts; }
        Map<String, Map<String, Object>> records;
        try { records = this.client.readCustomFields(indexes.keySet()); }
        catch (Exception error) {
            for (Integer index : indexes.values()) { contexts[index] = this.results.failField(contexts[index], error); }
            return contexts;
        }
        for (Integer index : indexes.values()) {
            ObjectExplorerClassifyService.FieldContext context = contexts[index];
            try {
                contexts[index] = this.preparation.prepareCustomField(context, records.get(context.objectName + '.' + context.fieldName));
            } catch (Exception error) { contexts[index] = this.results.failField(context, error); }
        }
        return contexts;
    }

    /**
     * 検証済みの標準・カスタム項目を一括更新
     * @param contexts 事前確認結果
     * @return 送信状態と個別拒否を反映した結果
     */
    private List<ObjectExplorerClassifyService.FieldContext> updateFields(List<ObjectExplorerClassifyService.FieldContext> contexts) {
        Map<String, ObjectExplorerClassifyService.FieldContext> selected = this.results.selectUpdates(contexts);
        if (selected.isEmpty()) { return contexts; }
        Map<String, Map<String, Object>> fields = new Map<String, Map<String, Object>>();
        Set<String> customNames = new Set<String>();
        for (String name : selected.keySet()) {
            selected.get(name).sent = true;
            fields.put(name, selected.get(name).metadata);
            if (selected.get(name).customField) { customNames.add(name); }
        }
        try {
            Map<String, String> results = this.client.updateFields(fields, customNames);
            return this.results.applyUpdateResults(contexts, results);
        } catch (Exception error) { return this.results.failUpdates(contexts, error); }
    }

    /**
     * 保存後の分類を別要求で取得して同じ項目へ照合
     * @param objectName 確認済み対象オブジェクト
     * @param contexts 保存対象
     * @return 保存後の確認結果
     */
    private List<ObjectExplorerClassifyService.FieldContext> verifyFields(String objectName, List<ObjectExplorerClassifyService.FieldContext> contexts) {
        // 個別拒否済みの対象を成功へ戻さない
        Set<String> names = this.results.getVerificationNames(contexts);
        // 全項目が失敗確定なら追加通信しない
        if (names.isEmpty()) { return contexts; }
        // 同一トランザクションのFieldDefinitionは古い値を返すため別APIで最新値を確認
        Map<String, Map<String, Object>> rows = this.client.readClassifyData(objectName, names);
        // 保存後の所有者も新しいID集合で取得
        Map<Id, SObject> owners = readOwners(rows, new List<Object>());
        // 元の入力順で同じ対象だけを確認
        for (Integer index = 0; index < contexts.size(); index++) {
            // 確認済み項目の結果は上書きしない
            ObjectExplorerClassifyService.FieldContext context = contexts[index];
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

    /** 分類変更の入口で標準の実効権限を確認 */
    private void requireEditAccess() {
        // 現在ユーザーの標準権限を取得してから判定
        List<UserPermissionAccess> permissions = this.selector.selectCurrentPermissions();
        // 不明な権限を許可として扱わない
        this.access.requireClassificationEditAccess(permissions);
    }

    /**
     * 参照可能なオブジェクトをラベルとAPI名で検索
     * @param term 部分一致の検索語
     * @return 候補の一覧
     */
    @AuraEnabled
    public static List<Map<String, Object>> searchObjects(String term) {
        // 公開入口のstaticを下位の業務処理へ持ち込まない
        ObjectExplorerController controller = new ObjectExplorerController();
        // 検索条件と参照可否を同じServiceで確認
        List<Map<String, Object>> rows = controller.structureService.searchObjects(term);
        // 候補だけを画面へ返却
        return rows;
    }

    /**
     * カスタム項目の作成・最終更新情報を取得
     * @param objectName 選択中オブジェクトAPI名
     * @return 可視な項目API名ごとの日時とユーザー名
     */
    @AuraEnabled
    public static Map<String, Object> getFieldAudit(String objectName) {
        // API呼出し前の失敗も区別して画面へ返す
        String stage = '対象オブジェクト・項目の確認';
        try {
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
            ObjectExplorerApiClient client = new ObjectExplorerApiClient();
            // カスタム項目がある場合だけ認証先組織を確認
            stage = 'API接続・接続先組織の確認';
            if (!batches.isEmpty()) { new SalesforceApiClient().verifyOrganization(); }
            // 全バッチの取得結果を対応付け前に保持
            stage = '項目の作成・更新情報のAPI取得';
            List<Map<String, Object>> records = new List<Map<String, Object>>();
            // 画面へ部分成功を返さず全件取得する
            for (Set<Id> batch : batches) {
                // 確認済みのIDだけを機能専用クライアントへ渡す
                Map<String, Object> response = client.readFieldAudit(batch);
                // 完了した応答だけを取り出す
                List<Map<String, Object>> batchRecords = service.readAuditRecords(response);
                // 後続のID検証に必要な元レコードを保持
                records.addAll(batchRecords);
            }
            // Userの参照可否を確認して人物IDをまとめる
            stage = '作成者・更新者の参照と項目の照合';
            Set<Id> userIds = service.collectAuditUserIds(records);
            // 人物名とリンクには実行ユーザーの可視Userだけを使用
            List<User> users = controller.selector.selectAuditUsers(userIds);
            // 同じ項目の日時と可視な人物だけを表示モデルへ変換
            Map<String, Object> result = service.createAuditView(targets, records, users);
            // 検証済みの可視項目だけを返却
            return result;
        } catch (Exception error) {
            // 取得段階と安全な理由だけをLWCへ返す
            throw SalesforceApiProtocol.publicException(error, stage, ObjectExplorerAccessPolicy.errorPublication(error));
        }
    }

    /**
     * 起点の項目と直接の参照関係を取得
     * @param objectName Describeで検証する起点API名
     * @param mode referenceは関連探索を含め、classify・fieldsは項目のみ取得。nullはreference
     * @return オブジェクト概要・項目・関連のMap
     */
    @AuraEnabled
    public static Map<String, Object> getObjectInfo(String objectName, String mode) {
        // ServiceとSelectorを同じ要求内で使用
        ObjectExplorerController controller = new ObjectExplorerController();
        // オブジェクトと項目の参照可否をDescribeで検証
        Map<String, Object> data = controller.structureService.getObjectInfo(objectName, mode);
        // 項目ごとの通信を避けて型表記を一括取得
        List<EntityParticle> types = controller.selector.selectFieldTypes((String)data.get('apiName'));
        // API用の型と表示用の表記を分離
        Map<String, Object> result = controller.fieldService.createFieldTypeView(data, types);
        // 表示モデルだけを画面へ返却
        return result;
    }
}