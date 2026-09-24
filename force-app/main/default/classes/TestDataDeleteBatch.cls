/** 対象オブジェクト全件を子から親へ直列削除 */
public with sharing class TestDataDeleteBatch implements Database.Batchable<SObject>, Database.Stateful {
    private TestDataDeleteBatchService service = new TestDataDeleteBatchService();
    private TestDataDeleteBatchSelector selector = new TestDataDeleteBatchSelector();
    private TestDataDeleteBatchWrapper wrapper;

    /**
     * 画面からの開始または前バッチの完了状態を受領
     * @param current 固定の削除計画と現在位置
     */
    public TestDataDeleteBatch(TestDataDeleteBatchWrapper current) {
        // 外部からの変更が保持状態へ影響しないよう複製
        this.wrapper = new TestDataDeleteBatchWrapper(current);
    }

    /**
     * 権限と重複を再確認して全件取得を開始
     * @param context 現在の標準ジョブ
     * @return 検証済みオブジェクトのカーソル
     */
    public Database.QueryLocator start(Database.BatchableContext context) {
        // 受付後の権限変更も検知
        this.wrapper = checkCurrentAccess();
        if (String.isNotEmpty(this.wrapper.errorMessage)) {
            throw new DeleteRunException(this.wrapper.errorMessage);
        }
        // 二つの受付が競合した場合は削除を行わず失敗させる
        Id jobId = context.getJobId();
        List<AsyncApexJob> jobs = this.selector.getOtherActiveJobs(jobId);
        if (!jobs.isEmpty()) {
            throw new DeleteRunException('別の削除ジョブがあるため開始を停止しました。');
        }
        // 組織に存在しないoptional objectでは空のカーソルを使用
        String objectName = this.wrapper.objectNames[this.wrapper.position];
        Boolean exists = Schema.getGlobalDescribe().containsKey(objectName);
        if (!exists) {
            return Database.getQueryLocator('SELECT Id FROM Account WHERE Id = null');
        }
        // 個人取引先のContactだけは親の削除に委ねる
        String recordFilter = this.service.getRecordFilter(objectName);
        return this.selector.getRecords(objectName, recordFilter);
    }

    /**
     * スコープ単位で権限を確認して部分成功の削除を実行
     * @param context 現在の標準ジョブ
     * @param scope 削除対象
     */
    public void execute(Database.BatchableContext context, List<SObject> scope) {
        // 権限喪失後は新しいスコープの削除を行わない
        this.wrapper = checkCurrentAccess();
        if (String.isNotEmpty(this.wrapper.errorMessage)) {
            return;
        }
        // DMLはバッチ入口に置き実行ユーザーの権限を適用
        List<Database.DeleteResult> results = Database.delete(scope, false, AccessLevel.USER_MODE);
        this.wrapper = this.service.aggregateResults(this.wrapper, results);
    }

    /**
     * 全件成功時だけ次のオブジェクトを開始
     * @param context 現在の標準ジョブ
     */
    public void finish(Database.BatchableContext context) {
        // 空オブジェクトの場合も継続前に実効権限を再確認
        this.wrapper = checkCurrentAccess();
        if (String.isNotEmpty(this.wrapper.errorMessage)) {
            throw new DeleteRunException(this.wrapper.errorMessage);
        }
        // 標準ジョブと残存件数の両方で親への継続を判定
        Id jobId = context.getJobId();
        List<AsyncApexJob> jobs = this.selector.getJob(jobId);
        String objectName = this.wrapper.objectNames[this.wrapper.position];
        Boolean exists = Schema.getGlobalDescribe().containsKey(objectName);
        String recordFilter = this.service.getRecordFilter(objectName);
        Integer remaining = 0;
        if (exists) {
            remaining = this.selector.getRemaining(objectName, recordFilter);
        }
        String stopReason = this.service.getStopReason(this.wrapper, jobs, remaining);
        if (String.isNotEmpty(stopReason)) {
            throw new DeleteRunException(objectName + ': ' + stopReason);
        }
        // 最後の親の削除後は新しいジョブを作成しない
        this.wrapper = this.service.createNext(this.wrapper);
        if (this.wrapper.position >= this.wrapper.objectNames.size()) {
            return;
        }
        // バッチ起動はメインクラスに置き画面を閉じても順序を維持
        Database.executeBatch(new TestDataDeleteBatch(this.wrapper), 200);
    }

    /** 各トランザクションの最新権限を取得して同じ実行条件を適用
     * @return 実行条件を確認した集計値
     */
    private TestDataDeleteBatchWrapper checkCurrentAccess() {
        // 同期受付時の判定を非同期トランザクションへ持ち越さない
        List<UserPermissionAccess> permissions = this.selector.getPermissions();
        // 各トランザクションで通常Sandboxを拒否
        List<Organization> organizations = this.selector.getOrganizations();
        TestDataDeleteBatchWrapper.Environment environment = TestDataDeleteBatchService.getEnvironment(organizations);
        // 判定の戻り値を入口でバッチ状態へ反映
        TestDataDeleteBatchWrapper result = this.service.checkExecution(this.wrapper, permissions, environment);
        return result;
    }

    /** 標準Apexジョブへ安全な停止理由を反映する例外 */
    public class DeleteRunException extends Exception {
    }
}
