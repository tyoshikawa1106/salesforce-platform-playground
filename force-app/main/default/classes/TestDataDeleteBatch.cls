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
        // 連動削除と価格の依存順序に対応する抽出条件を使用
        String recordFilter = this.service.getStageRecordFilter(this.wrapper);
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
        // 権限喪失時は対象レコードを再照会せず停止結果を通知
        this.wrapper = checkCurrentAccess();
        if (String.isNotEmpty(this.wrapper.errorMessage)) {
            sendResult('途中停止', this.wrapper.errorMessage);
            return;
        }
        // 標準ジョブと残存件数の両方で親への継続を判定
        Id jobId = context.getJobId();
        List<AsyncApexJob> jobs = this.selector.getJob(jobId);
        String objectName = this.wrapper.objectNames[this.wrapper.position];
        Boolean exists = Schema.getGlobalDescribe().containsKey(objectName);
        String recordFilter = this.service.getStageRecordFilter(this.wrapper);
        Integer remaining = 0;
        if (exists) {
            remaining = this.selector.getRemaining(objectName, recordFilter);
        }
        String stopReason = this.service.getStopReason(this.wrapper, jobs, remaining);
        if (String.isNotEmpty(stopReason)) {
            // 送信後に例外を投げず、メールの受付を確定させて連鎖を終了
            sendResult('途中停止', objectName + ': ' + stopReason + ' 現在段階の残件数: ' + remaining + '件。');
            return;
        }
        // 最後の対象だけが全体の正常終了を通知
        this.wrapper = this.service.createNext(this.wrapper);
        if (this.wrapper.position >= this.wrapper.objectNames.size()) {
            sendResult('完了', '最後の対象まで処理を終了しました。');
            return;
        }
        // 途中段階ではメールを送らず次の段階だけを起動
        Database.executeBatch(new TestDataDeleteBatch(this.wrapper), 200);
    }

    /** メール送信の受付結果を確認
     * @param outcome 完了または途中停止
     * @param detail 終了結果の説明
     */
    private void sendResult(String outcome, String detail) {
        // Serviceが組み立てた全体結果を一度だけ送信
        Messaging.SingleEmailMessage mail = this.service.buildResultMail(this.wrapper, outcome, detail);
        List<Messaging.SendEmailResult> results = Messaging.sendEmail(
            new List<Messaging.SingleEmailMessage>{ mail },
            false
        );
        if (!results[0].isSuccess()) {
            throw new EmailException('削除結果メールを送信できませんでした。');
        }
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
