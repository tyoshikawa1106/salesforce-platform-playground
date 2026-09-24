/** 削除画面に返す実行条件、対象一覧、残件数、標準ジョブ */
public with sharing class TestDataDeleteWrapper {
    // 実行先を画面で識別する組織名
    @AuraEnabled
    public String organizationName { get; set; }
    // 実行条件を満たさない理由
    @AuraEnabled
    public String errorMessage { get; set; }
    // 削除順に並べたオブジェクト名
    @AuraEnabled
    public List<String> objectNames { get; set; }
    // 組織の翻訳済みオブジェクト名
    @AuraEnabled
    public Map<String, String> labels { get; set; }
    // 機能未有効のため存在しないオブジェクト
    @AuraEnabled
    public List<String> unavailableObjects { get; set; }
    // 残件数を取得した対象
    @AuraEnabled
    public String objectName { get; set; }
    // 問い合わせ時点の未削除レコード件数
    @AuraEnabled
    public Integer remaining { get; set; }
    // 同じ機能に処理中のジョブがあるか
    @AuraEnabled
    public String executionState { get; set; }
    // 受付済みのジョブID
    @AuraEnabled
    public String jobId { get; set; }
    // 指定IDに一致する実行者自身の受付ジョブ
    @AuraEnabled
    public List<AsyncApexJob> jobs { get; set; }

    /** 未確認を成功と扱わない画面応答を初期化 */
    public TestDataDeleteWrapper() {
        // 画面の表示用データを自然な既定値で初期化
        this.organizationName = UserInfo.getOrganizationName();
        this.errorMessage = '';
        this.objectNames = new List<String>();
        this.labels = new Map<String, String>();
        this.unavailableObjects = new List<String>();
        this.objectName = '';
        this.remaining = 0;
        this.executionState = 'IDLE';
        this.jobId = '';
        this.jobs = new List<AsyncApexJob>();
    }
}
