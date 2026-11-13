/** テストデータ削除の共通定義・実行条件と画面応答 */
public with sharing class TestDataDeleteService {

    /** 全件削除の実行環境 */
    public enum Environment {
        DEVELOPMENT,
        DISALLOWED
    }

    /**
     * 子から親へ処理する対象一覧を取得
     * @return 呼び出しごとに独立した対象一覧
     */
    public List<String> getObjectNames() {
        // バッチの進捗に依存しない固定の削除計画を返却
        return new List<String>{
            'ContentDocument',
            'EmailMessage',
            'Task',
            'Event',
            'WorkOrderLineItem',
            'WorkOrder',
            'Case',
            'Entitlement',
            'ContractLineItem',
            'ServiceContract',
            'OrderItem',
            'Order',
            'OpportunityContactRole',
            'OpportunityLineItem',
            'Opportunity',
            'Contract',
            'Asset',
            'CampaignMember',
            'Campaign',
            'Lead',
            'Contact',
            'PricebookEntry',
            'Product2',
            'Account'
        };
    }

    /** Developer Editionまたは有効なScratchだけを許可
     * @param organizations 現在組織の種別と有効期限
     * @return 削除機能専用の環境判定
     */
    public Environment getEnvironment(List<Organization> organizations) {
        // 情報が取れない場合は削除を許可しない
        if (organizations == null || organizations.isEmpty()) {
            return Environment.DISALLOWED;
        }
        // SandboxのEditionだけを見てDeveloper Editionと誤認しない
        Organization organization = organizations[0];
        // 組織区分に対応する条件だけを評価し、通常Sandboxを拒否
        Boolean allowed = organization.IsSandbox == true
            ? organization.TrialExpirationDate != null && organization.TrialExpirationDate > System.now()
            : organization.IsSandbox == false && organization.OrganizationType == 'Developer Edition';
        return allowed ? Environment.DEVELOPMENT : Environment.DISALLOWED;
    }

    /**
     * 実効権限と開発環境を確認して対象一覧を返却
     * @param permissions 実行ユーザーの実効権限
     * @param executionEnvironment 開発環境の判定結果
     * @return 画面の対象一覧と拒否理由
     */
    public TestDataDeleteWrapper createView(List<UserPermissionAccess> permissions, Environment executionEnvironment) {
        // 権限を確認するまで対象データを問い合わせない
        TestDataDeleteWrapper wrapper = new TestDataDeleteWrapper();
        if (executionEnvironment != Environment.DEVELOPMENT) {
            wrapper.errorMessage = '開発組織でのみ実行できます。';
            return wrapper;
        }
        // 個別の権限セット名に依存せずSalesforceの実効権限を使用
        if (permissions.isEmpty() || permissions[0].PermissionsModifyAllData != true) {
            wrapper.errorMessage = '「すべてのデータの編集」権限が必要です。';
            return wrapper;
        }
        // 現在の組織メタデータと実行ユーザーの権限を取得
        Map<String, Schema.SObjectType> objectTypes = Schema.getGlobalDescribe();
        // 表示に必要な取得済み定義だけを保持
        Map<String, Schema.DescribeSObjectResult> descriptions = new Map<String, Schema.DescribeSObjectResult>();
        // 参照・検索・削除のすべてを満たす対象だけ許可
        Set<String> allowedObjects = new Set<String>();
        // 固定計画の各対象を一度だけDescribe
        for (String objectName : getObjectNames()) {
            // 未有効の機能は定義なしのまま渡す
            Schema.DescribeSObjectResult info = objectTypes.get(objectName)?.getDescribe(SObjectDescribeOptions.DEFERRED);
            // メタデータと権限を同じ対象名で対応付ける
            descriptions.put(objectName, info);
            // 削除可否は実際のユーザー権限から取得
            if (info?.isAccessible() == true && info.isQueryable() && info.isDeletable()) {
                allowedObjects.add(objectName);
            }
        }
        // 同じ判定結果から表示用の対象一覧を生成
        return createTargets(descriptions, allowedObjects);
    }

    /** 取得済み条件から対象一覧を生成し、機能・権限差異を引数で検証
     * @param descriptions 取得済みの対象定義
     * @param allowedObjects 参照・検索・削除のすべてを許可された対象名
     * @return 固定対象とその実行可否
     */
    @TestVisible
    private TestDataDeleteWrapper createTargets(Map<String, Schema.DescribeSObjectResult> descriptions, Set<String> allowedObjects) {
        // 画面へ返すデータはこの処理で新しく生成
        TestDataDeleteWrapper wrapper = new TestDataDeleteWrapper();
        // バッチと画面で同じ固定の削除計画を使用
        wrapper.objectNames = getObjectNames();
        for (String objectName : wrapper.objectNames) {
            // 存在しないoptional objectだけを対象外と表示
            Schema.DescribeSObjectResult description = descriptions.get(objectName);
            if (description == null) {
                wrapper.unavailableObjects.add(objectName);
                wrapper.labels.put(objectName, objectName);
                continue;
            }
            // 一つでも権限不足なら削除開始前に拒否
            wrapper.labels.put(objectName, description.getLabel());
            if (!allowedObjects.contains(objectName)) {
                wrapper.errorMessage = objectName + 'の参照・削除権限が必要です。';
            }
        }
        return wrapper;
    }

    /**
     * 任意のAPI名で対象外データを参照させない
     * @param current 権限確認済みの画面情報
     * @param objectName 要求された対象名
     * @return 検証後の画面情報
     */
    public TestDataDeleteWrapper checkObject(TestDataDeleteWrapper current, String objectName) {
        // 画面応答を複製して呼び出し元の値を変更しない
        TestDataDeleteWrapper wrapper = (TestDataDeleteWrapper) JSON.deserialize(
            JSON.serialize(current),
            TestDataDeleteWrapper.class
        );
        if (!wrapper.objectNames.contains(objectName) || wrapper.unavailableObjects.contains(objectName)) {
            wrapper.errorMessage = '指定されたオブジェクトは削除対象ではありません。';
        }
        wrapper.objectName = objectName ?? '';
        return wrapper;
    }

    /**
     * 重複起動と最終確認の有無を判定
     * @param current 権限確認済みの画面情報
     * @param activeJobs 実行中の同機能ジョブ
     * @param confirmation 全件削除の確認文字列
     * @return 受付可否
     */
    public TestDataDeleteWrapper checkStart(
        TestDataDeleteWrapper current,
        List<AsyncApexJob> activeJobs,
        String confirmation
    ) {
        // メイン処理が使う判定結果を副作用なく返却
        TestDataDeleteWrapper wrapper = (TestDataDeleteWrapper) JSON.deserialize(
            JSON.serialize(current),
            TestDataDeleteWrapper.class
        );
        wrapper.executionState = activeJobs.isEmpty() ? 'IDLE' : 'RUNNING';
        if (confirmation != 'DELETE_ALL') {
            wrapper.errorMessage = '対象オブジェクトの全件削除を確認してください。';
        }
        if (wrapper.executionState == 'RUNNING') {
            wrapper.errorMessage = '削除処理が実行中です。終了後に再確認してください。';
        }
        return wrapper;
    }
}
