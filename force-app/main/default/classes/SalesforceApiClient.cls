/** 組織内LWCのApex入口から使用する同一組織Salesforce APIの共通通信 */
public with sharing class SalesforceApiClient {

    private static final String NAMED_CREDENTIAL = 'SalesforceApiIntegration';
    private static final String API_VERSION = '68.0';
    private static final Integer REQUEST_TIMEOUT_MS = 30000;
    private static final Long REQUEST_BUDGET_MS = 100000;
    private static final Long DEADLINE = DateTime.now().getTime() + REQUEST_BUDGET_MS;

    /**
     * 実行ユーザー自身のPer User認証状態を取得
     * @return 認証値を含まない標準の状態
     */
    public ConnectApi.CredentialAuthenticationStatus getAuthenticationStatus() {
        // 対象を固定し、別利用者や共有Principalの認証情報を要求しない
        ConnectApi.Credential credential = ConnectApi.NamedCredentials.getCredential(
            NAMED_CREDENTIAL, 'SalesforceApiUserPrincipal', ConnectApi.CredentialPrincipalType.PerUserPrincipal
        );
        // 保存済みトークンでは接続先の組織も通信境界で検証する
        if (credential.authenticationStatus == ConnectApi.CredentialAuthenticationStatus.Configured) { verifyOrganization(); }
        // 資格情報の値やパラメーターは呼び出し元へ渡さない
        return credential.authenticationStatus;
    }

    /**
     * 標準OAuthフローを開始する実行ユーザー用URLを取得
     * @return プラットフォームが生成した認証開始URL
     */
    public String getAuthenticationUrl() {
        // 標準API例外の内部情報を通信境界で遮断する
        try {
            // 任意の接続先を画面から指定させない
            ConnectApi.OAuthCredentialAuthUrlInput input = new ConnectApi.OAuthCredentialAuthUrlInput();
            // 同一組織API用の既存設定を使用
            input.externalCredential = NAMED_CREDENTIAL;
            // 管理者の共有認証ではなく本人の資格情報へ保存
            input.principalType = ConnectApi.CredentialPrincipalType.PerUserPrincipal;
            // 先頭スラッシュ付きの組織内パスを渡し、戻り先がホスト名へ連結されないようにする
            input.returnUrl = '/lightning/n/ObjectExplorer';
            // プラットフォームがPKCEと認証状態を管理するURLを生成
            ConnectApi.OAuthCredentialAuthUrl result = ConnectApi.NamedCredentials.getOAuthCredentialAuthUrl(input);
            // トークンの取得・保存を独自実装せず標準フローへ委ねる
            return result.authenticationUrl;
        } catch (Exception error) {
            // 接続設定や資格情報を含めない固定案内だけを返す
            throw new IntegrationException('API認証を開始できませんでした。接続設定と権限を管理者に確認してください。');
        }
    }

    /** 実行ユーザー本人の同一組織API用資格情報だけを削除 */
    public void revokeAuthentication() {
        // 設定本体や共有Principalではなく、実行ユーザーの保存済み資格情報を対象にする
        try {
            // ユーザーや接続先を画面入力で切り替えさせない
            ConnectApi.NamedCredentials.deleteCredential(NAMED_CREDENTIAL, 'SalesforceApiUserPrincipal', ConnectApi.CredentialPrincipalType.PerUserPrincipal);
        } catch (Exception error) {
            // 標準APIの例外本文やトークン情報を公開しない
            throw new IntegrationException('API認証の解除結果を確認できませんでした。画面を再読み込みして確認してください。');
        }
    }

    /**
     * Named Credentialで認証したAPIを呼び出す
     * @param path 固定APIパス
     * @param method GETまたはPATCH
     * @param body 認証情報を含まない更新内容
     * @return JSON応答、本文のない成功時は空Map
     */
    public Map<String, Object> request(String path, String method, String body) {
        requireRequest(path, method);
        // JSONの文字列値を認証用の差し込み式として解釈させない
        String jsonBody = body?.replace('{!', '\\u007b!');
        HttpResponse response = sendRequest('/services/data/v' + API_VERSION + '/' + path, method, jsonBody);
        if (response.getStatusCode() / 100 != 2) {
            IntegrationException failure = new IntegrationException(SalesforceApiProtocol.httpMessage(response));
            // 更新要求の明示的な拒否だけを、結果不明と区別する
            if (method == 'PATCH' && new Set<Integer>{400, 401, 403, 404, 409, 422, 429}.contains(response.getStatusCode())) { throw new RejectedUpdateException(failure.getMessage()); }
            throw failure;
        }
        try {
            // HTTP成功とJSON形式の正常性を別々に確認する
            return String.isBlank(response.getBody()) ? new Map<String, Object>() : (Map<String, Object>)JSON.deserializeUntyped(response.getBody());
        } catch (Exception error) {
            // 応答本文は公開せず形式不正だけを通知する
            throw new IntegrationException('[OE-API-RESPONSE] API応答をオブジェクト形式で読み取れませんでした。');
        }
    }

    /**
     * 同一組織の相対APIパスと対応操作だけを許可
     * @param path APIバージョン以降の固定相対パス
     * @param method GETまたはPATCH
     */
    private void requireRequest(String path, String method) {
        if (String.isBlank(path) || path.startsWith('/') || path.contains('..') || path.contains(':')) { throw new IntegrationException('Salesforce APIの要求形式が不正です。'); }
        if (!new Set<String>{'GET', 'PATCH'}.contains(method)) { throw new IntegrationException('Salesforce APIの要求形式が不正です。'); }
    }

    /**
     * RESTとSOAPで同じ認証・待ち時間・通信エラー処理を使用
     * @param path 固定APIパス
     * @param method HTTPメソッド
     * @param body 認証値を含まない本文テンプレート
     * @return HTTP応答
     */
    private HttpResponse sendRequest(String path, String method, String body) {
        HttpRequest request = new HttpRequest();
        // 組織ごとの認証情報は共通名の指定ログイン情報で管理
        request.setEndpoint('callout:' + NAMED_CREDENTIAL + path);
        request.setMethod(method);
        Boolean soap = path.startsWith('/services/Soap/');
        request.setHeader('Content-Type', soap ? 'text/xml; charset=UTF-8' : 'application/json');
        if (soap) { request.setHeader('SOAPAction', 'updateMetadata'); }
        Long remaining = DEADLINE - DateTime.now().getTime();
        if (remaining <= 0) { throw new IntegrationException('[OE-API-BUDGET] API待ち時間の上限に達しました。最新状態を再取得してください。'); }
        request.setTimeout(Math.min(REQUEST_TIMEOUT_MS, remaining.intValue()));
        request.setBody(body ?? '');
        try { return new Http().send(request); }
        catch (CalloutException error) {
            // 本文の判定と公開可能な理由の作成を純粋な変換へ委譲する
            throw new IntegrationException(SalesforceApiProtocol.connectionMessage(error.getMessage()));
        }
    }

    /**
     * 接続先が実行中の組織であることを確認
     */
    public void verifyOrganization() {
        Map<String, Object> response = request('query/?q=SELECT+Id+FROM+Organization', 'GET', null);
        // 認証先の組織IDを応答検証へ渡す
        try {
            // 現在組織と認証先の識別子だけを比較する
            new SalesforceApiProtocol.RecordReader().requireQueryRecord(response, 'Id', String.valueOf(UserInfo.getOrganizationId()));
        } catch (IntegrationException error) {
            // 識別子不一致と応答不備を区別し、組織IDは公開しない
            if (error.getMessage().startsWith('[OE-API-ID-MISMATCH]')) { throw new IntegrationException('[OE-ORG-MISMATCH] API接続先がこのSalesforce組織と一致しません。'); }
            throw new IntegrationException('[OE-ORG-RESPONSE] API接続先の組織情報を確認できませんでした。');
        }

    }

    /** 認証値やAPI応答本文を含まない連携エラー */
    public class IntegrationException extends Exception {}

    /** APIが明示的に拒否した分類更新 */
    public class RejectedUpdateException extends Exception {}
    /**
     * Metadata APIの更新要求を同一組織の指定ログイン情報へ送信
     * @param body 認証値を含まないSOAP本文テンプレート
     * @return 検証対象のHTTP応答
     */
    public HttpResponse sendMetadataUpdate(String body) {
        return sendRequest('/services/Soap/m/' + API_VERSION, 'POST', body);
    }
}