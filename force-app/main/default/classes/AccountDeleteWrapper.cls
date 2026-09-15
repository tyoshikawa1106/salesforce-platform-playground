/** 画面に返す受付結果と標準ジョブの状態 */
public with sharing class AccountDeleteWrapper {

    // 実行を拒否する理由
    @AuraEnabled
    public String blockMessage { get; set; }
    // 受付結果の案内
    @AuraEnabled
    public String message { get; set; }
    // 受付済みジョブID
    @AuraEnabled
    public String jobId { get; set; }
    // 実行者自身の直近ジョブ
    @AuraEnabled
    public AsyncApexJob latestJob { get; set; }

    /** 未受付の画面を初期化 */
    public AccountDeleteWrapper() {
        this.blockMessage = '';
        this.message = '';
        this.jobId = '';
        this.latestJob = new AsyncApexJob();
    }
}