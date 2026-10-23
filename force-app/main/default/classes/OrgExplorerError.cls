/**
 * 利用者へ公開できるエラー
 */
public with sharing class OrgExplorerError {

    // 失敗の分類
    @AuraEnabled
    public String code { get; set; }
    // 安全な説明
    @AuraEnabled
    public String message { get; set; }

    /**
     * 未分類のエラーを初期化
     */
    public OrgExplorerError() {
        // 失敗の分類を初期化
        this.code = '';
        // 安全な説明を初期化
        this.message = '';
    }
}