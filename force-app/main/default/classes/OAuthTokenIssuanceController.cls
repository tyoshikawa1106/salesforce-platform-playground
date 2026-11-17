/** OAuth トークン発行画面の Apex 入口 */
public with sharing class OAuthTokenIssuanceController {
    private static final OAuthTokenIssuanceService SERVICE = new OAuthTokenIssuanceService();

    /**
     * 利用者が認可に使うこの組織のオリジンを取得
     * @return この組織の My Domain オリジン
     */
    @AuraEnabled
    public static String getAuthorizationOrigin() {
        // 認可先をトークン交換先と同じ組織に統一
        String origin = Url.getOrgDomainUrl().toExternalForm();
        // 画面の認可リクエスト組み立てに利用
        return origin;
    }

    /**
     * 認可コードをトークンへ交換
     * @param authorization 認可開始時のクライアント、コールバック、コードと PKCE 検証値、必要な場合はシークレット
     * @return 応答に含まれるトークンと関連情報または失敗理由
     */
    @AuraEnabled
    public static OAuthTokenIssuanceResult exchangeCode(Map<String, String> authorization) {
        // 一度限りのコードをこの組織のトークンエンドポイントへ渡す
        OAuthTokenIssuanceResult result = SERVICE.exchangeCode(authorization);
        // キャッシュを経由せず現在の画面に返却
        return result;
    }
}
