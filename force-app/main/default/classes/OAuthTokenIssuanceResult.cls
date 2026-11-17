/** OAuth トークン発行画面に返す交換結果 */
public with sharing class OAuthTokenIssuanceResult {
    // API 呼び出しに使用するアクセストークン
    @AuraEnabled public String accessToken { get; set; }
    // Salesforce が返した場合のリフレッシュトークン
    @AuraEnabled public String refreshToken { get; set; }
    // Salesforce が返した場合の OpenID Connect ID トークン
    @AuraEnabled public String idToken { get; set; }
    // API 呼び出し先となるインスタンス
    @AuraEnabled public String instanceUrl { get; set; }
    // 発行したアクセストークンへ適用されたスコープ
    @AuraEnabled public String scope { get; set; }
    // Salesforce によるトークンタイプ
    @AuraEnabled public String tokenType { get; set; }
    // 秘密値や生の応答を含まない失敗理由
    @AuraEnabled public String errorMessage { get; set; }

    /** 未取得状態を初期化 */
    public OAuthTokenIssuanceResult() {
        // 返却されていない項目を空値で統一
        accessToken = null;
        // 発行条件を満たした応答だけで設定
        refreshToken = null;
        // OpenID Connect を要求した応答だけで設定
        idToken = null;
        // 成功応答のインスタンス情報を受け取るまで未設定
        instanceUrl = null;
        // 成功時に Salesforce が返した値を表示
        scope = null;
        // 成功時に Salesforce が返した種類を表示
        tokenType = null;
        // 失敗結果の場合だけ画面向けの理由を設定
        errorMessage = null;
    }
}
