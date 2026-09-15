/**
 * 参照可能な取引先を分割削除し、確定件数をfinishまで保持する
 */
public with sharing class AccountDeleteBatch implements Database.Batchable<SObject>, Database.Stateful {

    private AccountDeleteBatchService service = new AccountDeleteBatchService();
    private AccountDeleteBatchSelector selector = new AccountDeleteBatchSelector();
    private AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper();

    /**
     * 起動時点の環境と権限を確認して対象を取得
     * @param context バッチ実行情報
     * @return 削除対象の取引先
     */
    public Database.QueryLocator start(Database.BatchableContext context) {
        // 開始可否と拒否理由を判定
        this.wrapper = this.service.checkStartConditions(this.wrapper);
        // エラー判定
        if (String.isNotEmpty(this.wrapper.errorMessage)) {
            // 開始拒否時の空の対象を取得
            Database.QueryLocator noAccounts = this.selector.getNoAccounts();
            return noAccounts;
        }
        // 削除対象を取得
        Database.QueryLocator accounts = this.selector.getAccounts();
        return accounts;
    }

    /**
     * 今回のスコープをユーザー権限で削除
     * @param context バッチ実行情報
     * @param scope 今回の取引先
     */
    public void execute(Database.BatchableContext context, List<SObject> scope) {
        // DML結果と照合する削除対象を保持
        List<Account> accounts = (List<Account>) scope;
        // 削除可否を判定し、中止した対象を失敗件数へ反映
        this.wrapper = this.service.checkExecutionConditions(this.wrapper, accounts);
        // エラー判定
        if (String.isNotEmpty(this.wrapper.errorMessage)) { return; }
        // DMLはバッチのメイン処理で実行し、個別の削除権限を適用
        List<Database.DeleteResult> results = Database.delete(accounts, false, AccessLevel.USER_MODE);
        // 今回の削除結果を加算した戻り値を次のスコープへ引き継ぐ
        this.wrapper = this.service.aggregateDeleteResults(results, accounts, this.wrapper);
    }

    /**
     * 確定済み件数を実行ユーザーへ通知
     * @param context バッチ実行情報
     */
    public void finish(Database.BatchableContext context) {
        // 現在のジョブ情報を集計値とともに通知へ渡す
        Id jobId = context.getJobId();
        List<AsyncApexJob> jobs = this.selector.getJobs(jobId);
        // 通知に必要な状態はバッチから引数で渡す
        Boolean sent = this.service.finishRun(jobs, this.wrapper);
        // 結果として返された通知失敗は入口でジョブのエラーにする
        if (!sent) { throw new EmailException('削除結果メールを送信できませんでした。'); }
    }
}