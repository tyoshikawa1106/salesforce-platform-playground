/** 画面の実行可否判定と受付応答を生成 */
public with sharing class AccountDeleteService {

    /**
     * 現在の実行条件から開始拒否理由を取得
     * @return 実行可能なら空文字、それ以外は公開可能な理由
     */
    public String getBlockMessage() {
        // 本番と判定不能な組織で削除を拒否
        Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
        if (!developmentEnvironment) {
            // 環境判定に失敗しても許可側へ倒さない
            return 'Scratch Org・Developer Edition・Sandboxでのみ実行できます。';
        }
        // 専用の利用許可と既存のAccount権限を別々に適用
        Boolean canUseFeature = FeatureManagement.checkPermission('RunAccountDelete');
        if (!canUseFeature) {
            // 画面経由以外でも機能利用権限を必須にする
            return '取引先一括削除の利用権限がありません。';
        }
        // オブジェクトの参照権限と削除権限を事前確認
        Schema.DescribeSObjectResult accountDescribe = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        Boolean canRead = accountDescribe.isAccessible();
        Boolean canDelete = accountDescribe.isDeletable();
        if (!canRead || !canDelete) {
            // 共有レコードの削除可否は後続のユーザーモードDMLで判定
            return '取引先の参照・削除権限が必要です。';
        }
        // 許可済みの要求だけを開始処理へ渡す
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