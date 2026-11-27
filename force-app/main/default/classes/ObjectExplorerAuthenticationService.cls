/** 実行ユーザーのAPI認証状態の表示変換と標準認証URLの検証 */
public with sharing class ObjectExplorerAuthenticationService {
    /**
     * 認証状態を値や組織設定を含まない画面用状態へ変換
     * @param status 標準APIが返した実行ユーザーの状態
     * @return 認証済み・要認証・確認不能の区分
     */
    public Map<String, Object> createAuthenticationState(ConnectApi.CredentialAuthenticationStatus status) {
        // 標準APIの三状態を画面用状態へ対応付ける
        Map<String, String> statuses = new Map<String, String>{'Configured' => 'AUTHENTICATED', 'NotConfigured' => 'REQUIRED'};
        // 不明値は認証操作で解決すると推定しない
        String state = statuses.get(String.valueOf(status)) ?? 'UNAVAILABLE';
        // 資格情報や内部エラーを含めず、固定案内だけを返す
        return new Map<String, Object>{'status' => state, 'message' => new Map<String, String>{
            'AUTHENTICATED' => '',
            'REQUIRED' => 'Salesforce APIを使用します。認証ボタンをクリックしてください。',
            'UNAVAILABLE' => 'Salesforce APIの認証状態を確認できませんでした。接続設定と権限を確認して画面を再読み込みしてください。'
        }.get(state)};
    }

    /**
     * 接続失敗のうち明示的な認証拒否だけを再認証へ振り分け
     * @param error API通信または標準認証APIの失敗
     * @return 内部情報を含まない画面用状態
     */
    public Map<String, Object> createAuthenticationFailure(Exception error) {
        // 接続先・ネットワーク・権限の失敗を認証失効と混同しない
        Map<String, Object> state = createAuthenticationState(null);
        if (error instanceof SalesforceApiClient.IntegrationException) {
            String reason = error.getMessage();
            if (reason.startsWith('[OE-AUTH-401]')) { return createAuthenticationState(ConnectApi.CredentialAuthenticationStatus.NotConfigured); }
            if (reason.startsWith('[OE-ORG-MISMATCH]')) {
                state.put('message', '認証先の組織が一致しません。指定ログイン情報 InternalSalesforceApi の接続先と、認証した組織を確認してください。');
            } else if (reason.startsWith('[OE-API-HTTP-403]')) {
                state.put('message', 'Salesforce API がアクセスを拒否しました（HTTP 403）。認証したユーザーの API 利用権限とアクセス制限を確認してください。');
            }
        }
        return state;
    }

    /**
     * 標準認証URLの接続先と通信方式を固定
     * @param value プラットフォームから返った認証開始URL
     * @return 現在組織のHTTPS認証URL
     */
    public String requireAuthenticationUrl(String value) {
        // 現在組織のHTTPSオリジンとパス境界を固定し、他ホストやユーザー情報を拒否する
        String authenticationUrl = SalesforceApiProtocol.organizationAuthenticationUrl(value);
        // 標準URLだけを受け付け、値やクエリ文字列は診断へ含めない
        if (authenticationUrl == null) { throw ObjectExplorerAccessPolicy.createException('[OE-AUTH-URL] API認証の開始URLを取得できませんでした。管理者に確認してください。'); }
        // 認証情報を記録せず利用者のリンクへ渡す
        return authenticationUrl;
    }
}