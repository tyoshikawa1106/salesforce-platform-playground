const OAUTH_CALLBACK_KEYS = ['code', 'state', 'error', 'error_description'];

// Web Crypto のバイト列を OAuth が受け付ける Base64URL へ変換
function encodeBase64Url(bytes) {
    // 短いバイト配列を Base64 エンコーダーの入力に変換
    const binary = String.fromCharCode(...bytes);
    // URL に含められない文字とパディングを除去
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

// 認可操作ごとに使い捨ての state と PKCE の組を用意
export async function createAuthorizationProof(crypto) {
    // PKCE 検証値に十分なエントロピーを確保
    const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    // 認可リクエストには検証値そのものを含めずダイジェストを送る
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    // 貼り付けた応答を今回の認可に結び付ける状態を発行
    const state = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    // 認可と交換にそれぞれ使う値を一つの操作として保持
    return { verifier, challenge: encodeBase64Url(new Uint8Array(digest)), state };
}

// 貼り付けで扱えるコールバック URL かを判定
function parseWebUrl(value) {
    // スキームとホストを含む URL だけを解析
    const url = new URL(value);
    // 認証情報やフラグメント付きの URL はコールバックとして扱わない
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) {
        // 不正な入力を認可要求に含めない
        throw new Error('HTTP または HTTPS のコールバック URL を指定してください。');
    }
    // URL の一致確認とパラメータの抽出に使用
    return url;
}

// 登録済み URL と画面入力から認可要求を組み立てる
export function createAuthorizationUrl(origin, { clientId, redirectUri }, proof) {
    // コールバックに使える URL 形式か認可前に確認
    const callback = parseWebUrl(redirectUri);
    // OAuth の応答パラメータと既存のクエリの衝突を拒否
    if (OAUTH_CALLBACK_KEYS.some((key) => callback.searchParams.has(key))) {
        // code や state が既存パラメータとして使われていないことを要求
        throw new Error('コールバック URL に OAuth の応答用パラメータが含まれています。');
    }
    // Apex が返した組織のオリジンから認可先を組み立てる
    const authorizationUrl = new URL('/services/oauth2/authorize', origin);
    // URL に含める値を安全にエンコードできる形へまとめる
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        state: proof.state,
        code_challenge: proof.challenge,
        code_challenge_method: 'S256'
    });
    // スコープは Salesforce のアプリ設定に委ね、秘密は交換時にだけ送信
    authorizationUrl.search = params.toString();
    // 別タブの認可操作に渡す
    return authorizationUrl.href;
}

// 認可先から戻った URL を登録済みのコールバックと操作状態に照合
export function readAuthorizationCallback(value, redirectUri, state) {
    // コールバック先の比較に利用する登録済み URL を解析
    const callback = parseWebUrl(redirectUri);
    // 貼り付けた URL からクエリを抽出
    const received = parseWebUrl(value.trim());
    // 戻り先のオリジンおよびパスを照合
    if (received.origin !== callback.origin || received.pathname !== callback.pathname) {
        // 異なるコールバックへのリダイレクトで取得した値を交換しない
        throw new Error('認可を開始したときのコールバック URL と一致しません。');
    }
    // 登録済み URL に元から付くパラメータも保持されていることを確認
    for (const key of new Set(callback.searchParams.keys())) {
        // 同名パラメータの個数と順序を含めて一致を確認
        if (JSON.stringify(received.searchParams.getAll(key)) !== JSON.stringify(callback.searchParams.getAll(key))) {
            // 別の URL で取得した値を交換しない
            throw new Error('認可を開始したときのコールバック URL と一致しません。');
        }
    }
    // 貼り付けた URL に OAuth の失敗応答がある場合は交換できない
    if (received.searchParams.has('error')) {
        // コールバック先のエラー画面と OAuth 認可の失敗を区別
        throw new Error('Salesforce の認可が完了していません。アプリの OAuth 設定と利用権限を確認してください。');
    }
    // 重複する認可コードを誤って解釈しない
    const codes = received.searchParams.getAll('code');
    // ブラウザのアドレスバーにコードが残っていることを要求
    if (codes.length !== 1 || !codes[0].trim()) {
        // コピーし直すか認可をやり直すための案内を表示
        throw new Error('URL から認可コードを読み取れません。アドレスバーの URL 全体を貼り付けてください。');
    }
    // 今回の認可以外の応答を拒否
    const states = received.searchParams.getAll('state');
    // 一つの状態が今回の認可と完全一致することを確認
    if (states.length !== 1 || states[0] !== state) {
        // 別タブや過去の認可から取得したコードによる交換を防止
        throw new Error('今回の認可に対応する URL ではありません。認可を開始したタブの URL を確認してください。');
    }
    // URLSearchParams が一度だけデコードした値を交換に使用
    return codes[0];
}

// 応答に含まれるトークンを表示項目へ変換
export function getTokenRows(result, copyFeedback) {
    // 任意のリフレッシュトークンは空の場合も表示
    const rows = [
        { name: 'accessToken', label: 'アクセストークン', value: result.accessToken },
        { name: 'refreshToken', label: 'リフレッシュトークン', value: result.refreshToken }
    ];
    // OpenID Connect を要求した応答のときだけ表示行を追加
    if (result.idToken) {
        // 他のトークンと同じ操作でコピーできるようにする
        rows.push({ name: 'idToken', label: 'ID トークン（OpenID Connect）', value: result.idToken });
    }
    // コピーしたトークンの行だけに通知を付ける
    return rows.map((row) => ({ ...row, copyMessage: row.name === copyFeedback?.name ? copyFeedback.message : '' }));
}

// Salesforce にログインするときのユーザー名を氏名に添える
export function formatExecutionUser(name, username, userRecord) {
    // 未取得の場合は読み込み中と取得できなかった状態を区別
    if (!name || !username) {
        // レコード ID などで代用せず取得状況を表示
        return userRecord?.data || userRecord?.error ? '確認できませんでした' : '確認中';
    }
    // 発行前にログイン中のユーザーを識別できる形式で表示
    return `${name} (${username})`;
}
