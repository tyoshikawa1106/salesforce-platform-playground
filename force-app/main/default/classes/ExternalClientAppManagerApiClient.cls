/** 外部クライアントアプリ管理専用の本人認証によるREST通信 */
public with sharing class ExternalClientAppManagerApiClient {
    // 標準認証APIの境界だけをテストで置き換える
    @TestVisible
    private static CredentialAccess credentialAccess = new CredentialAccess();

    /** 標準認証APIへの接続境界 */
    public virtual class CredentialAccess {
        /** 本人の保存済み認証状態を取得
         * @return 標準APIの認証状態
         */
        public virtual ConnectApi.CredentialAuthenticationStatus getStatus() {
            return ConnectApi.NamedCredentials.getCredential(
                    'ExternalClientAppManager',
                    'ExternalClientAppUserPrincipal',
                    ConnectApi.CredentialPrincipalType.PerUserPrincipal
                )
                .authenticationStatus;
        }
        /** 標準認証URLを取得
         * @return 現在組織の認証開始URL
         */
        public virtual String getUrl() {
            ConnectApi.OAuthCredentialAuthUrlInput input = new ConnectApi.OAuthCredentialAuthUrlInput();
            input.externalCredential = 'ExternalClientAppManager';
            input.principalType = ConnectApi.CredentialPrincipalType.PerUserPrincipal;
            input.returnUrl = '/lightning/n/ExternalClientAppManager';
            return ConnectApi.NamedCredentials.getOAuthCredentialAuthUrl(input).authenticationUrl;
        }
        /** 本人の管理用資格情報だけを解除 */
        public virtual void revoke() {
            ConnectApi.NamedCredentials.deleteCredential(
                'ExternalClientAppManager',
                'ExternalClientAppUserPrincipal',
                ConnectApi.CredentialPrincipalType.PerUserPrincipal
            );
        }
    }

    /** ローカル候補を検索する固定Tooling API要求
     * @return 加工前のアプリ一覧
     */
    public Map<String, Object> listApplications() {
        return request(
            '/services/data/v68.0/tooling/query/?q=SELECT+Id,DeveloperName,MasterLabel,DistributionState+FROM+ExternalClientApplication+ORDER+BY+DeveloperName+LIMIT+201',
            'GET',
            null
        );
    }

    /** 対象アプリのコンシューマー一覧を取得
     * @param appId 所属確認済みのアプリID
     * @return 加工前のコンシューマー一覧
     */
    public Map<String, Object> readConsumers(String appId) {
        return request('/services/data/v68.0/apps/oauth/credentials/' + appId, 'GET', null);
    }

    /** 本人の標準認証状態を取得し、保存済み接続の本人性も確認
     * @return 認証済み・未認証・確認不能の区分
     */
    public String getAuthenticationStatus() {
        ConnectApi.CredentialAuthenticationStatus status = credentialAccess.getStatus();
        if (status == ConnectApi.CredentialAuthenticationStatus.NotConfigured) {
            return 'REQUIRED';
        }
        if (status != ConnectApi.CredentialAuthenticationStatus.Configured) {
            return 'UNAVAILABLE';
        }
        try {
            verifyIdentity();
            return 'AUTHENTICATED';
        } catch (CalloutException error) {
            // 明示的な認証拒否だけを再認証へ案内する
            return new Set<String>{ 'HTTP 401', 'AUTHENTICATION_REQUIRED' }.contains(error.getMessage())
                ? 'REQUIRED'
                : 'UNAVAILABLE';
        }
    }

    /** 標準OAuthの認証URLを取得
     * @return 現在組織のHTTPS認証開始URL
     */
    public String getAuthenticationUrl() {
        String authenticationUrl = credentialAccess.getUrl();
        // 認証先を任意の外部ホストへ差し替えさせない
        if (
            String.isBlank(authenticationUrl) ||
            !authenticationUrl.startsWith(Url.getOrgDomainUrl().toExternalForm() + '/')
        ) {
            throw new CalloutException('認証開始URLを確認できません。');
        }
        return authenticationUrl;
    }

    /** 実行ユーザー本人の管理用接続だけを解除 */
    public void revokeAuthentication() {
        // 接続設定や他ユーザーの資格情報を変更しない
        credentialAccess.revoke();
    }

    /**
     * 専用Named Credentialへ要求を送信
     * @param path 固定の組織内APIパス
     * @param method GET、POST、PATCH、DELETE
     * @param body 秘密を含まない操作内容
     * @return JSONオブジェクト
     */
    public Map<String, Object> request(String path, String method, String body) {
        // パスと操作の検証を送信前に完了
        requireRequest(path, method);
        // 本人の資格情報をSalesforce側で付与
        HttpRequest request = new HttpRequest();
        // ローテーション対象と認証元を分離する専用接続を使用
        request.setEndpoint('callout:ExternalClientAppManager' + path);
        // 固定操作とJSON形式で送信
        request.setMethod(method);
        // JSON応答を明示
        request.setHeader('Accept', 'application/json');
        // 空の生成要求もJSONで統一
        request.setHeader('Content-Type', 'application/json');
        // 無応答時は更新要求を自動再送しない
        request.setTimeout(30000);
        // トークンや秘密の本文差し込みは使用しない
        if (body != null) {
            request.setBody(body);
        }
        // 応答本文と例外は公開入口で機密情報を除去
        HttpResponse response = new Http().send(request);
        // UserInfoが403で返す明示的なトークン失効だけを再認証へ分類する
        if (
            path == '/services/oauth2/userinfo' &&
            response.getStatusCode() == 403 &&
            new Set<String>{ 'Bad_OAuth_Token', 'Missing_OAuth_Token' }.contains(response.getBody()?.trim())
        ) {
            throw new CalloutException('AUTHENTICATION_REQUIRED');
        }
        // APIの自由文を例外へ含めない
        if (response.getStatusCode() / 100 != 2) {
            throw new CalloutException('HTTP ' + response.getStatusCode());
        }
        // 更新成功でも本文がない場合は後続の状態確認で判定
        return parseResponse(response.getBody());
    }

    private Map<String, Object> parseResponse(String body) {
        // 本文のない成功は呼び出し側の状態確認へ委ねる
        if (String.isBlank(body)) {
            return new Map<String, Object>();
        }
        try {
            Object value = JSON.deserializeUntyped(body);
            // nullや配列をオブジェクト応答として扱わない
            if (value instanceof Map<String, Object>) {
                return (Map<String, Object>) value;
            }
        } catch (JSONException error) {
            // JSON解析エラーの本文断片を公開しない
            throw new CalloutException('API応答の形式を確認できません。');
        }
        throw new CalloutException('API応答の形式を確認できません。');
    }

    /** 接続先組織とOAuth認証ユーザーが実行主体と一致することを確認 */
    public void verifyIdentity() {
        // Per User接続で別アカウントを選んだ場合も拒否
        Map<String, Object> identity = request('/services/oauth2/userinfo', 'GET', null);
        // 組織とユーザーの両方を検証
        if (
            String.valueOf(identity.get('organization_id')) != String.valueOf(UserInfo.getOrganizationId()) ||
            String.valueOf(identity.get('user_id')) != String.valueOf(UserInfo.getUserId())
        ) {
            throw new CalloutException('API認証の組織またはユーザーが一致しません。');
        }
    }
    /** API本文を公開せず、アクセス拒否とその他の失敗を案内する
     * @param error API処理の例外
     * @return 秘密を含まない固定の案内
     */
    public static String accessFailureMessage(Exception error) {
        if (error.getMessage() == 'HTTP 403') {
            return 'REST APIからの資格情報へのアクセスが拒否されました。設定 → 外部クライアントアプリケーション → 設定で「REST APIを使用した外部クライアントアプリケーションのコンシューマーの秘密へのアクセスを許可」をオンにしてください。既にオンの場合は、External Client App DeveloperとView Client Secretの権限を確認してください。';
        }
        return '資格情報へのアクセスを確認できません。管理用API認証と接続先・管理権限を確認してください。';
    }

    private void requireRequest(String path, String method) {
        // 組織外URLや認証式を入力として受け付けない
        if (path == null || !Pattern.matches('/services/(?![\\s\\S]*(?:\\.\\.|:))[\\s\\S]*', path)) {
            throw new CalloutException('APIパスが不正です。');
        }
        // 管理操作に使うHTTPメソッドを限定
        if (!new Set<String>{ 'GET', 'POST', 'PATCH', 'DELETE' }.contains(method)) {
            throw new CalloutException('API操作が不正です。');
        }
    }
}
