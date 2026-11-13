/** 画面の実行可否判定と受付応答を生成 */
public with sharing class AccountDeleteService {

    /**
     * 現在の実行条件から開始拒否理由を取得
     * @return 実行可能なら空文字、それ以外は公開可能な理由
     */
    public String getBlockMessage() {
        // 公開入口では現在の環境と実効権限を取得
        Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
        // カスタム権限はユーザーの割当から判定
        Boolean canUseFeature = FeatureManagement.checkPermission('RunAccountDelete');
        // 参照と削除の両方の権限を必須にする
        Schema.DescribeSObjectResult info = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        // 共通判定へ実際の条件を渡す
        return getBlockMessageForConditions(developmentEnvironment, canUseFeature, info.isAccessible() && info.isDeletable());
    }

    /** 組織設定を変えず許可と拒否を検証する共通判定
     * @param developmentEnvironment 開発環境か
     * @param canUseFeature 機能利用権限があるか
     * @param canReadAndDelete 取引先の参照と削除の両方が許可されているか
     * @return 許可時は空文字、それ以外は拒否理由
     */
    @TestVisible
    private String getBlockMessageForConditions(Boolean developmentEnvironment, Boolean canUseFeature, Boolean canReadAndDelete) {
        // 本番と不明な環境で削除を開始しない
        if (developmentEnvironment != true) {
            return 'Scratch Org・Developer Edition・Sandboxでのみ実行できます。';
        }
        // 機能利用権限の不足をCRUDより優先
        if (canUseFeature != true) {
            return '取引先一括削除の利用権限がありません。';
        }
        // 参照か削除のいずれかがなければ拒否
        if (canReadAndDelete != true) {
            return '取引先の参照・削除権限が必要です。';
        }
        // すべての条件を満たす要求だけ許可
        return '';
    }

    /**
     * 自身の標準ジョブから画面応答を生成
     * @param jobs 検索済みの自身の最新ジョブ
     * @return 画面表示用の応答
     */
    public AccountDeleteWrapper createView(List<AsyncApexJob> jobs) {
        AccountDeleteWrapper response = new AccountDeleteWrapper();
        response.blockMessage = getBlockMessage();
        if (String.isBlank(response.blockMessage) && !jobs.isEmpty()) {
            response.latestJob = jobs[0];
        }
        return response;
    }

    /**
     * 実行条件と登録済みジョブから受付可否を判定
     * @param activeJobs 実行中の同機能ジョブ
     * @return 受付可否の応答
     */
    public AccountDeleteWrapper createStartView(List<AsyncApexJob> activeJobs) {
        // 起動直前の実行条件を応答へ反映
        AccountDeleteWrapper response = createView(new List<AsyncApexJob>());
        // 権限の拒否理由を優先し、受付済みジョブの重複も防ぐ
        if (String.isBlank(response.blockMessage) && !activeJobs.isEmpty()) {
            response.blockMessage = '実行中の取引先削除があります。完了するまでお待ちください。';
        }
        return response;
    }

    /**
     * 登録できたジョブの受付応答を生成
     * @param jobId 登録されたジョブID
     * @return 削除完了と区別した受付結果
     */
    public AccountDeleteWrapper createAcceptedView(Id jobId) {
        // 登録済みのジョブを受付結果として返す
        AccountDeleteWrapper response = new AccountDeleteWrapper();
        response.jobId = String.valueOf(jobId);
        response.message = 'バッチを受け付けました。処理結果をメールで通知します。';
        return response;
    }
}