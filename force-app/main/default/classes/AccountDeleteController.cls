/**
 * 取引先一括削除画面の入口
 */
public with sharing class AccountDeleteController {

    private static AccountDeleteService service = new AccountDeleteService();
    private static AccountDeleteSelector selector = new AccountDeleteSelector();

    /**
     * 現在の権限と追跡対象のジョブを取得
     * @param jobId 追跡対象のジョブID、未指定時は自身の最新ジョブ
     * @return 画面表示用の実行可否とジョブ
     */
    @AuraEnabled
    public static AccountDeleteWrapper getView(Id jobId) {
        // 参照権限のないユーザーへジョブを検索しない
        try {
            // 検索前に実行条件の判定結果を取得
            List<AsyncApexJob> jobs = new List<AsyncApexJob>();
            AccountDeleteWrapper wrapper = service.createView(jobs);
            // エラー判定
            if (String.isNotEmpty(wrapper.blockMessage)) { return wrapper; }
            // 実行者のジョブ情報を取得
            jobs = selector.getJobs(jobId);
            // 取得した情報から画面の応答を生成
            wrapper = service.createView(jobs);
            return wrapper;
        } catch (Exception e) {
            // 内部の検索エラーを利用者へ公開しない
            throw new AuraHandledException('実行状態を取得できませんでした。ジョブの参照権限を確認してください。');
        }
    }

    /**
     * 確認画面から取引先削除を受付
     * @return ジョブIDまたは安全な拒否理由
     */
    @AuraEnabled
    public static AccountDeleteWrapper startRun() {
        // 組織判定の予期しない失敗も画面用の安全な例外へ変換
        try {
            // 検索前に実行条件の判定結果を取得
            List<AsyncApexJob> jobs = new List<AsyncApexJob>();
            AccountDeleteWrapper wrapper = service.createView(jobs);
            // エラー判定
            if (String.isNotEmpty(wrapper.blockMessage)) { return wrapper; }
            // 登録済みジョブを取得
            jobs = selector.getActiveJobs();
            // 重複起動の可否を判定
            wrapper = service.createStartView(jobs);
            // エラー判定
            if (String.isNotEmpty(wrapper.blockMessage)) { return wrapper; }
            // 画面の入口からバッチを直接登録
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            // 受付結果を生成
            wrapper = service.createAcceptedView(jobId);
            return wrapper;
        } catch (Exception e) {
            // 内部情報を画面へ公開しない
            throw new AuraHandledException('バッチを開始できませんでした。実行環境と権限を確認してください。');
        }
    }
}