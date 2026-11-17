/** OAuth トークン応答と秘密値を含む要求の扱い */
@IsTest
private with sharing class OAuthTokenIssuanceServiceTest {
    private static final String REDIRECT_URI = 'https://example.test/return?view=setup';
    private static final String CODE = 'code+test&=';
    private static final String VERIFIER = 'A'.repeat(43);

    @IsTest
    static void exchangesCodeWithPkceAndReturnsOptionalIdToken() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.setMock(HttpCalloutMock.class, new TokenResponse(200,
                '{"access_token":"access","refresh_token":"refresh","id_token":"id.jwt","scope":"api","token_type":"Bearer"}',
                'secret+&'
            ));

            Test.startTest();
            OAuthTokenIssuanceResult result = new OAuthTokenIssuanceService().exchangeCode(authorization('secret+&', VERIFIER));
            Test.stopTest();

            Assert.areEqual('access', result.accessToken, 'アクセストークンを返す');
            Assert.areEqual('refresh', result.refreshToken, 'リフレッシュトークンを返す');
            Assert.areEqual('id.jwt', result.idToken, '応答に含まれた ID トークンを返す');
            Assert.areEqual('Bearer', result.tokenType, 'トークンタイプを返す');
            Assert.isNull(result.errorMessage, '正常に交換できた場合はエラーなし');
        }
    }

    @IsTest
    static void allowsExchangeWithoutSecretOrOptionalTokens() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.setMock(HttpCalloutMock.class, new TokenResponse(200, '{"access_token":"access"}', null));

            Test.startTest();
            OAuthTokenIssuanceResult result = new OAuthTokenIssuanceService().exchangeCode(authorization(null, VERIFIER));
            Test.stopTest();

            Assert.areEqual('access', result.accessToken, 'アクセストークンを返す');
            Assert.isNull(result.refreshToken, '未発行のリフレッシュトークンは空');
            Assert.isNull(result.idToken, '未発行の ID トークンは空');
            Assert.isNull(result.errorMessage, '任意項目がなくても取得は成功');
        }
    }

    @IsTest
    static void rejectsInvalidVerifierWithoutCallout() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            OAuthTokenIssuanceResult result = new OAuthTokenIssuanceService().exchangeCode(authorization(null, 'invalid'));
            Integer callouts = Limits.getCallouts();
            Test.stopTest();

            Assert.areEqual(0, callouts, '不正な PKCE 検証値を送信しない');
            Assert.isTrue(result.errorMessage.contains('PKCE'), 'PKCE 検証値のエラーを返す');
        }
    }

    @IsTest
    static void omitsSensitiveDetailsFromOAuthFailures() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.setMock(HttpCalloutMock.class, new TokenResponse(
                400, '{"error":"invalid_grant","error_description":"private-response","access_token":"private-token"}', null
            ));

            Test.startTest();
            OAuthTokenIssuanceResult result = new OAuthTokenIssuanceService().exchangeCode(authorization(null, VERIFIER));
            Test.stopTest();

            Assert.isTrue(result.errorMessage.contains('期限切れ'), '認可コードを再取得するための案内を返す');
            Assert.isFalse(result.errorMessage.contains('private-response'), 'OAuth の生の診断情報を返さない');
            Assert.isNull(result.accessToken, '異常応答に含まれた値をトークン表示に使わない');
        }
    }

    /** JSON オブジェクト以外の応答には画面向けのエラーを返す */
    @IsTest
    static void rejectsNonObjectTokenResponse() {

        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.setMock(HttpCalloutMock.class, new TokenResponse(200, '["private-response"]', null));

            Test.startTest();
            OAuthTokenIssuanceResult result = new OAuthTokenIssuanceService().exchangeCode(authorization(null, VERIFIER));
            Test.stopTest();

            Assert.areEqual('トークン交換で有効な応答を受け取れませんでした。', result.errorMessage, '応答本文を表示しない');
            Assert.isNull(result.accessToken, '想定外の応答からトークンを返さない');
        }
    }

    /**
     * コールバックで一度だけ受け取った認可情報を準備
     * @param secret 対象アプリが要求するシークレット、null を許容
     * @param verifier 認可時の検証値または拒否対象の値
     * @return トークン交換要求
     */
    private static Map<String, String> authorization(String secret, String verifier) {
        return new Map<String, String>{
            'clientId' => 'key',
            'clientSecret' => secret,
            'redirectUri' => REDIRECT_URI,
            'code' => CODE,
            'codeVerifier' => verifier
        };
    }

    /** Salesforce トークンエンドポイントの代替応答 */
    private class TokenResponse implements HttpCalloutMock {
        private final Integer statusCode;
        private final String body;
        private final String secret;

        /**
         * リクエストの検証条件と応答を設定
         * @param statusCode Salesforce の応答ステータス
         * @param body 代替応答の本文
         * @param secret 送信を期待するシークレット、不要な場合は null
         */
        private TokenResponse(Integer statusCode, String body, String secret) {
            this.statusCode = statusCode;
            this.body = body;
            this.secret = secret;
        }

        /**
         * トークン要求を検証して代替応答を返却
         * @param request 送信されたトークン交換要求
         * @return テストの設定に応じた代替応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.areEqual(Url.getOrgDomainUrl().toExternalForm() + '/services/oauth2/token', request.getEndpoint(),
                'コールバック URL を交換先に使用しない');
            Assert.areEqual('POST', request.getMethod(), '秘密値は POST 本文に送る');
            Map<String, String> fields = new Map<String, String>();
            for (String value : request.getBody().split('&')) {
                Integer separator = value.indexOf('=');
                fields.put(value.substring(0, separator), EncodingUtil.urlDecode(value.substring(separator + 1), 'UTF-8'));
            }
            Assert.areEqual('authorization_code', fields.get('grant_type'), '認可コード交換で発行する');
            Assert.areEqual('key', fields.get('client_id'), '認可先アプリのキーを送信');
            Assert.areEqual(REDIRECT_URI, fields.get('redirect_uri'), '認可開始時と同じ登録 URL を送信');
            Assert.areEqual(CODE, fields.get('code'), '予約文字を含むコードを正確に送信');
            Assert.areEqual(VERIFIER, fields.get('code_verifier'), 'PKCE の元の検証値を送信');
            Assert.areEqual(secret != null, fields.containsKey('client_secret'), 'シークレット送信の有無を確認');
            Assert.areEqual(secret, fields.get('client_secret'), 'シークレットの値を正確に送信');
            HttpResponse response = new HttpResponse();
            response.setStatusCode(statusCode);
            response.setBody(body);
            return response;
        }
    }
}