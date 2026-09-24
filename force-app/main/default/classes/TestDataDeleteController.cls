/** テストデータ一括削除画面の参照と実行受付 */
public with sharing class TestDataDeleteController {
    private static TestDataDeleteService service = new TestDataDeleteService();
    @TestVisible
    private static TestDataDeleteSelector selector = new TestDataDeleteSelector();

    /**
     * 現在の実行条件と受付ジョブを取得
     * @param jobId 受付したジョブID、未受付ならnull
     * @return 対象一覧と実行状態
     */
    @AuraEnabled
    public static TestDataDeleteWrapper getView(Id jobId) {
        try {
            // 権限判定をデータ検索より先に実施
            List<UserPermissionAccess> permissions = selector.getPermissions();
            List<Organization> organizations = selector.getOrganizations();
            // 一般Sandboxを許可しない削除専用の環境判定
            TestDataDeleteBatchWrapper.Environment environment = TestDataDeleteBatchService.getEnvironment(
                organizations
            );
            TestDataDeleteWrapper wrapper = service.createView(permissions, environment);
            if (String.isNotEmpty(wrapper.errorMessage)) {
                return wrapper;
            }
            // 重複判定と追跡IDの照会を分離
            List<AsyncApexJob> activeJobs = selector.getActiveJobs();
            wrapper.executionState = activeJobs.isEmpty() ? 'IDLE' : 'RUNNING';
            wrapper.jobs = selector.getJobs(jobId);
            return wrapper;
        } catch (Exception e) {
            // SOQLや内部識別子を表示しない
            throw new AuraHandledException('実行状態を取得できませんでした。権限を確認してください。');
        }
    }

    /**
     * 一つの対象の残件数を取得
     * @param objectName 対象オブジェクト
     * @return 残件数または取得できない理由
     */
    @AuraEnabled
    public static TestDataDeleteWrapper getRemaining(String objectName) {
        try {
            // 画面を経由しない照会にも権限と対象の制限を適用
            List<UserPermissionAccess> permissions = selector.getPermissions();
            List<Organization> organizations = selector.getOrganizations();
            // 一般Sandboxを許可しない削除専用の環境判定
            TestDataDeleteBatchWrapper.Environment environment = TestDataDeleteBatchService.getEnvironment(
                organizations
            );
            TestDataDeleteWrapper wrapper = service.createView(permissions, environment);
            if (String.isNotEmpty(wrapper.errorMessage)) {
                return wrapper;
            }
            wrapper = service.checkObject(wrapper, objectName);
            if (String.isNotEmpty(wrapper.errorMessage)) {
                return wrapper;
            }
            // 件数クエリをループ内で実行しない
            wrapper.remaining = selector.getRemaining(objectName);
            return wrapper;
        } catch (Exception e) {
            throw new AuraHandledException('残件数を取得できませんでした。対象の参照権限を確認してください。');
        }
    }

    /**
     * 全件削除の確認後に最初のバッチを登録
     * @param confirmation 全件削除の確認文字列
     * @return 受付したジョブIDまたは拒否理由
     */
    @AuraEnabled
    public static TestDataDeleteWrapper startRun(String confirmation) {
        try {
            // ボタンの表示状態に依存せず実効権限を確認
            List<UserPermissionAccess> permissions = selector.getPermissions();
            List<Organization> organizations = selector.getOrganizations();
            // 一般Sandboxを許可しない削除専用の環境判定
            TestDataDeleteBatchWrapper.Environment environment = TestDataDeleteBatchService.getEnvironment(
                organizations
            );
            TestDataDeleteWrapper wrapper = service.createView(permissions, environment);
            if (String.isNotEmpty(wrapper.errorMessage)) {
                return wrapper;
            }
            // 二重起動の受付を抑止し非同期startでも再判定
            List<AsyncApexJob> activeJobs = selector.getActiveJobs();
            wrapper = service.checkStart(wrapper, activeJobs, confirmation);
            if (String.isNotEmpty(wrapper.errorMessage)) {
                return wrapper;
            }
            // 起動処理をControllerに置き専用スクリプトは提供しない
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(plan), 200);
            wrapper.jobId = String.valueOf(jobId);
            wrapper.executionState = 'RUNNING';
            return wrapper;
        } catch (Exception e) {
            throw new AuraHandledException('削除を開始できませんでした。実行条件とApexジョブを確認してください。');
        }
    }
}