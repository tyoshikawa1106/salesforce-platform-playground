/** OAuth 認可コード交換に必要な検証と Salesforce へのトークン要求 */
public with sharing class OAuthTokenIssuanceService {
    private static final Pattern VERIFIER = Pattern.compile('^[A-Za-z0-9._~-]{43,128}$');
    private static final String TOKEN_PATH = '/services/oauth2/token';

    /**
     * この組織のトークンエンドポイントで認可コードを交換
     * @param authorization 認可に対応する clientId、redirectUri、code、codeVerifier、および任意の clientSecret
     * @return 画面に返せる発行結果
     */
    public OAuthTokenIssuanceResult exchangeCode(Map<String, String> authorization) {
        // どのエラーでも認証情報を画面へ返さず理由だけを通知
        OAuthTokenIssuanceResult wrapper = new OAuthTokenIssuanceResult();
        // 空の要求も未入力として扱えるようフィールドを取得
        String clientId = authorization?.get('clientId');
        // 同じアプリの設定に必要な場合だけ使うシークレットを取得
        String clientSecret = authorization?.get('clientSecret');
        // 認可時に Salesforce と照合したコールバックを取得
        String redirectUri = authorization?.get('redirectUri');
        // 登録済みコールバックで発行されたコードを取得
        String code = authorization?.get('code');
        // 認可時のチャレンジに対応する元の検証値を取得
        String codeVerifier = authorization?.get('codeVerifier');
        // 不完全な認可情報で一度限りの交換を開始しない
        if (String.isBlank(clientId) || String.isBlank(redirectUri) || String.isBlank(code) || String.isBlank(codeVerifier)) {
            // 認可のやり直しが必要な入力不足を知らせる
            wrapper.errorMessage = '認可コードの交換に必要な情報が不足しています。';
            // トークンエンドポイントへの要求を中止
            return wrapper;
        }
        // PKCE 検証値が OAuth リクエストとして有効な形式か判定
        Boolean validVerifier = VERIFIER.matcher(codeVerifier).matches();
        // 認可操作に対応する検証値の形式違反を拒否
        if (!validVerifier) {
            // 秘密値を含めずに失敗理由を通知
            wrapper.errorMessage = 'PKCE 検証値が無効です。もう一度認可してください。';
            // トークンエンドポイントへの要求を中止
            return wrapper;
        }

        // OAuth のフォームデータとして予約文字を安全に送る
        String body = 'grant_type=authorization_code'
            + '&client_id=' + EncodingUtil.urlEncode(clientId, 'UTF-8')
            + '&redirect_uri=' + EncodingUtil.urlEncode(redirectUri, 'UTF-8')
            + '&code=' + EncodingUtil.urlEncode(code, 'UTF-8')
            + '&code_verifier=' + EncodingUtil.urlEncode(codeVerifier, 'UTF-8');
        // シークレットは要求するアプリでのみ設定
        if (!String.isBlank(clientSecret)) {
            // シークレットを URL へ出さずフォーム本文に設定
            body += '&client_secret=' + EncodingUtil.urlEncode(clientSecret, 'UTF-8');
        }
        // 送信先と本文を独立して構成
        HttpRequest request = new HttpRequest();
        // URL 入力はリダイレクト照合用に使い、送信先は組織が管理する My Domain に限定
        request.setEndpoint(Url.getOrgDomainUrl().toExternalForm() + TOKEN_PATH);
        // 認可コードとシークレットを POST 本文で送る
        request.setMethod('POST');
        // Salesforce のトークンエンドポイントが受け付ける形式を指定
        request.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        // トークン交換結果を JSON で要求
        request.setHeader('Accept', 'application/json');
        // エンドポイントに送る値を本文へ設定
        request.setBody(body);
        // コールアウト失敗時に社内設定や秘密値を露出させない
        HttpResponse response;
        try {
            // 一度限りの認可コードなのでリクエストを自動再試行しない
            response = new Http().send(request);
        } catch (CalloutException error) {
            // 設定不足と到達性の確認を促す固定文言
            wrapper.errorMessage = 'トークン交換先に接続できませんでした。組織の通信許可を確認してください。';
            // 失敗の詳細をレスポンスに含めず終了
            return wrapper;
        }
        // 応答の機密値のうち画面に必要なフィールドだけを抽出
        readResponse(response, wrapper);
        // 正常時はトークンと取得情報、失敗時は理由のみを返す
        return wrapper;
    }

    /**
     * 決められた成功項目と安全な失敗理由だけを抽出
     * @param response Salesforce のトークン交換応答
     * @param wrapper 抽出結果を書き込む未設定の応答
     */
    private void readResponse(HttpResponse response, OAuthTokenIssuanceResult wrapper) {
        // 不正な JSON や異なる型が返る場合に備える
        Object decoded;
        Boolean invalidJson = false;
        try {
            // 生の OAuth 応答はこの処理内だけで扱う
            decoded = JSON.deserializeUntyped(response.getBody());
        } catch (JSONException error) {
            // 不正な本文と JSON の null を区別
            invalidJson = true;
        }
        // 解析できない応答と想定外の型を同じエラーとして通知
        if (invalidJson || (decoded != null && !(decoded instanceof Map<String, Object>))) {
            wrapper.errorMessage = 'トークン交換で有効な応答を受け取れませんでした。';
            // 応答の詳細を露出せず終了
            return;
        }
        // JSON の null は従来どおり各フィールドが未返却の応答として扱う
        Map<String, Object> payload = (Map<String, Object>) decoded;
        // Salesforce の HTTP ステータスで発行結果を区別
        if (response.getStatusCode() != 200) {
            // Salesforce の既知のエラー識別子だけから案内を選ぶ
            String errorCode = readString(payload, 'error');
            // 失敗時に error_description や生の応答を表示しない
            wrapper.errorMessage = describeFailure(errorCode);
            // エラー応答をトークンとして解釈しない
            return;
        }
        // アクセストークンのない応答を取得成功として扱わない
        String accessToken = readString(payload, 'access_token');
        // リフレッシュトークンなどの任意項目と成功条件を区別
        if (String.isBlank(accessToken)) {
            // 期待する成功データがないことを通知
            wrapper.errorMessage = '応答にアクセストークンが含まれていません。';
            // 任意情報も画面へ返さず終了
            return;
        }
        // 正常応答の認可情報を画面に渡す
        wrapper.accessToken = accessToken;
        // スコープとポリシーが許可する場合のトークンを設定
        wrapper.refreshToken = readString(payload, 'refresh_token');
        // OpenID Connect が適用されたときだけ存在する値を設定
        wrapper.idToken = readString(payload, 'id_token');
        // Salesforce が返した API 呼び出し先を設定
        wrapper.instanceUrl = readString(payload, 'instance_url');
        // 実際に許可されたスコープを設定
        wrapper.scope = readString(payload, 'scope');
        // 呼び出し側が認可形式を確認できるようトークンタイプを設定
        wrapper.tokenType = readString(payload, 'token_type');
    }

    /**
     * 応答のうち文字列型のフィールドのみ取得
     * @param payload 解析済み応答、null を許容
     * @param key 画面に返せる応答フィールド
     * @return 文字列値または未返却を示す null
     */
    private String readString(Map<String, Object> payload, String key) {
        // 空の JSON 応答もフィールドがない応答として扱う
        Object value = payload == null ? null : payload.get(key);
        // 想定外の型をトークン文字列として返さない
        return value instanceof String ? (String) value : null;
    }

    /**
     * OAuth エラーコードを秘密情報のない画面表示へ変換
     * @param errorCode Salesforce が返したエラーの識別子、null を許容
     * @return 利用者向けの固定文言
     */
    private String describeFailure(String errorCode) {
        // 認可コードの失効や認可時との不一致は新しい認可を必要とする
        if (errorCode == 'invalid_grant') {
            // 利用者が交換を再開する操作を案内
            return '認可コードを交換できませんでした。使用済みや期限切れの可能性があります。もう一度認可してください。';
        }
        // クライアント認証と認可コードの問題を区別
        if (errorCode == 'invalid_client' || errorCode == 'invalid_client_id') {
            // 対象アプリの設定確認を案内
            return 'アプリを認証できませんでした。コンシューマーキーとシークレットの設定を確認してください。';
        }
        // DPoP の鍵に紐付くトークンはこの画面の交換対象から外す
        if (errorCode == 'use_dpop_nonce' || errorCode == 'invalid_dpop_proof') {
            // DPoP を必要とする場合は原因を画面に表示
            return 'このアプリは DPoP を要求しています。';
        }
        // その他の失敗は応答本文なしで設定条件の確認を案内
        return 'トークン交換に失敗しました。対象アプリの OAuth 設定を確認してください。';
    }
}
