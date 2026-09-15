/**
 * 登録ユーザーの権限で取引先削除バッチを定期起動
 */
public with sharing class AccountDeleteBatchScheduler implements Schedulable {

    private AccountDeleteBatchService service = new AccountDeleteBatchService();
    private AccountDeleteBatchSelector selector = new AccountDeleteBatchSelector();

    /**
     * 定期実行の条件を確認してバッチを登録
     * @param context Salesforceのスケジュール実行コンテキスト
     */
    public void execute(SchedulableContext context) {
        // 拒否と登録失敗を通知するための理由を保持
        String reason = '';
        try {
            // 登録時点の環境とユーザー権限で判定
            reason = this.service.getBlockMessage();
            if (String.isBlank(reason)) {
                // 権限を確認した後に登録済みジョブを取得
                List<AsyncApexJob> jobs = this.selector.getActiveJobs();
                if (!jobs.isEmpty()) {
                    reason = '実行中の取引先削除があります。完了するまでお待ちください。';
                }
            }
            if (String.isBlank(reason)) {
                // 定期実行の入口からバッチを直接登録
                Database.executeBatch(new AccountDeleteBatch(), 2000);
                return;
            }
        } catch (Exception e) {
            // 生の例外を通知せず登録失敗を案内
            reason = '取引先削除を開始できませんでした。実行環境・権限・実行中ジョブを確認してください。';
        }
        // 通知失敗の扱いは定期実行の入口に置く
        Boolean sent = this.service.sendRejection(reason);
        if (!sent) {
            throw new EmailException('開始拒否メールを送信できませんでした。');
        }
    }
}