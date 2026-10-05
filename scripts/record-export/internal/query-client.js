// 用途: 既存認証のCLIで一括取得と個別補完を実行し、応答完了と整合性を確認する。
const fs = require('node:fs');
const path = require('node:path');
const { QUERY_ERROR_CODES, QUERY_TIMEOUT_CODES } = require('./error-definitions');
const RESPONSE_LIMIT = 64 * 1024 * 1024;

// 長いSOQLをURL引数ではなくPOST本文に格納し、読み取りだけを実行する。
function createQueryClient(directory, targetOrg, invoke, sobjectUrl) {
    // Describeが返した相対パスからバージョンだけを取り出し、項目定義と検索を一致させる。
    const apiPath = /^([/]services[/]data[/]v\d+[.]\d+)[/]sobjects[/][A-Za-z][A-Za-z0-9_]*$/.exec(sobjectUrl)?.[1];
    // バージョン不明時に古いAPIへフォールバックして項目を欠落させない。
    if (!apiPath) throw new Error('Describeから検索用APIバージョンを確認できませんでした。');
    // 逐次実行専用のリクエスト本文の保存先を固定する。
    const requestFile = path.join(directory, 'query-request.json');
    // APIエラーは固定コードだけを表示し、レコード値や生本文を漏らさない。
    function fail(code, context = '') {
        // 自動分割してよい原因を明示的に分類する。
        const allowed = [...QUERY_ERROR_CODES, 'QUERY_TOO_COMPLICATED', 'INVALID_SESSION_ID'];
        // 未知のエラー本文は表示しない。
        const safeCode = allowed.includes(code) ? code : 'QUERY_FAILED';
        // 未知でも形式が正しい元コードは捨てず、生本文とは分離して残す。
        const originalCode = typeof code === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(code) ? code : '情報なし';
        // 分類用コードとは別に、APIが返した識別子と通信結果を保持する。
        const diagnostic = `元エラーコード: ${originalCode}${context ? ` / ${context}` : ''}`;
        // 呼び出し元は原因に応じて分割または停止する。
        throw Object.assign(
            new Error(
                (QUERY_TIMEOUT_CODES.includes(safeCode)
                    ? `Salesforce側で検索がタイムアウトしました (${safeCode})。検索条件・クエリプランを確認してください。`
                    : `検索に失敗しました (${safeCode})。`) + ` / ${diagnostic}`
            ),
            { code: safeCode, diagnostic }
        );
    }
    // 複数の独立した検索を指定順に実行し、失敗した項目から他の項目への波及を防ぐ。
    async function request(requests, controls) {
        // API応答の失敗にも、今回の通信に要した時間を付ける。
        const started = performance.now();
        // レコード値ではなくクエリだけをPOST本文へ書く。
        fs.writeFileSync(
            requestFile,
            JSON.stringify({ allOrNone: false, collateSubrequests: false, compositeRequest: requests }),
            { mode: 0o600 }
        );
        // ストリーム専用経路を使わず、CLIが受信完了または通信失敗を返すまで待つ。
        const response = await invoke(
            [
                'api',
                'request',
                'rest',
                `${apiPath}/composite`,
                '--method',
                'POST',
                '--body',
                `@${requestFile}`,
                '--header',
                'Content-Type:application/json',
                '--target-org',
                targetOrg
            ],
            controls
        );
        // 任意の本文を検索成功として扱わず、期待したComposite応答だけを許可する。
        const body = response?.body;
        // CLIが正常終了して返したHTTP応答と、CLI自体の失敗を区別する。
        const context = `CLI終了コード: 0 / 検索経過: ${((performance.now() - started) / 1000).toFixed(1)}秒`;
        // 外側HTTPの状態をサブリクエストの状態と分けて残す。
        const outerContext = `HTTP: ${Number.isInteger(response?.statusCode) ? response.statusCode : '情報なし'} / ${context}`;
        // 外側のエラーでは個別結果が存在しないため、検索全体の失敗として返す。
        if (response?.statusCode !== 200 || Array.isArray(body))
            fail(Array.isArray(body) ? body[0]?.errorCode : undefined, outerContext);
        // 呼び出しごとの保持量を制限し、上限超過は既存の再分割へ渡す。
        if (Buffer.byteLength(JSON.stringify(body) || '', 'utf8') > RESPONSE_LIMIT)
            throw Object.assign(new Error('検索結果が応答サイズ上限を超えました。'), {
                code: 'BUFFER_LIMIT',
                diagnostic: `分類コード: BUFFER_LIMIT / 受信上限: ${RESPONSE_LIMIT}バイト / ${outerContext}`
            });
        // 応答欠落・重複・別リクエストの混入を検知する。
        if (!Array.isArray(body?.compositeResponse) || body.compositeResponse.length !== requests.length)
            throw Object.assign(new Error('Composite応答の件数が要求と一致しません。'), {
                code: 'INVALID_QUERY_RESPONSE',
                diagnostic: outerContext
            });
        // 応答配列の位置ではなく要求時の識別子で照合する。
        const parts = new Map(body.compositeResponse.map((part) => [part?.referenceId, part]));
        // 参照IDが重複している応答は取り違えを防ぐため使用しない。
        if (parts.size !== requests.length || requests.some((item) => !parts.has(item.referenceId)))
            throw Object.assign(new Error('Composite応答の識別子が要求と一致しません。'), {
                code: 'INVALID_QUERY_RESPONSE',
                diagnostic: outerContext
            });
        // 保存順を決める呼び出し側へ、要求と同じ順番で返す。
        return requests.map((item) => ({ ...parts.get(item.referenceId), diagnosticContext: outerContext }));
    }
    // クエリ全体の応答量に上限を設け、ページを無制限に蓄積しない。
    async function query(soql, controls = {}) {
        // Query Moreも同じCompositeの読み取りサブリクエストとして送信する。
        let url = `${apiPath}/query/?q=${encodeURIComponent(soql)}`;
        // 全ページのレコードを上限内に限って保持する。
        const records = [];
        // ページ間で保持する結果のJSONサイズを累積する。
        let bytes = 0;
        // 最初に返された総件数が途中で変化しないことを確認する。
        let total;
        // 同じページを反復する異常応答を検知する。
        const visited = new Set();
        // Query Moreがある間だけ続行する。
        while (url) {
            // 通常取得は従来どおり一つの検索を実行する。
            const [part] = await request([{ method: 'GET', url, referenceId: 'records' }], controls);
            // 取得済みページを含む累積量も上限内へ制限する。
            bytes += Buffer.byteLength(JSON.stringify(part), 'utf8');
            // 合計サイズ超過は既存の分割処理へ渡す。
            if (bytes > RESPONSE_LIMIT)
                throw Object.assign(new Error('検索結果が応答サイズ上限を超えました。'), {
                    code: 'BUFFER_LIMIT',
                    diagnostic: `分類コード: BUFFER_LIMIT / 受信上限: ${RESPONSE_LIMIT}バイト / ${part.diagnosticContext}`
                });
            // サブリクエストの失敗を値なしに変換しない。
            if (part.httpStatusCode !== 200)
                fail(
                    part.body?.[0]?.errorCode,
                    `検索HTTP: ${Number.isInteger(part.httpStatusCode) ? part.httpStatusCode : '情報なし'} / ${part.diagnosticContext}`
                );
            // クエリ応答の基本構造を検証する。
            const page = part.body;
            // ページごとのtotalSizeは全体件数であり、レコード数とは別に扱う。
            if (
                !Array.isArray(page?.records) ||
                typeof page.done !== 'boolean' ||
                !Number.isSafeInteger(page.totalSize) ||
                page.totalSize < 0
            )
                fail(undefined, part.diagnosticContext);
            // 初回だけ総件数を確定する。
            total ??= page.totalSize;
            // 不整合なページを連結しない。
            if (total !== page.totalSize || (!page.done && !page.records.length))
                fail(undefined, part.diagnosticContext);
            // 大量配列を引数展開せず追加する。
            for (const record of page.records) records.push(record);
            // 最終ページでは件数が揃ったことを確認する。
            if (page.done) {
                // 中途半端な結果を出力しない。
                if (records.length !== total) fail(undefined, part.diagnosticContext);
                // 収集処理へ完全な応答として返す。
                return { records, totalSize: total, done: true };
            }
            // API応答から任意URLへアクセスしないようQuery Moreの相対パスだけを許可する。
            if (
                !/^\/services\/data\/v\d+\.\d+\/query\/[A-Za-z0-9-]+$/.test(page.nextRecordsUrl) ||
                visited.has(page.nextRecordsUrl)
            )
                fail(undefined, part.diagnosticContext);
            // 次ページの重複を検知する。
            visited.add(page.nextRecordsUrl);
            // 次のAPIページへ進める。
            url = page.nextRecordsUrl;
        }
    }
    // 補完は通常のQuery APIへ一項目ずつ送り、Composite全体の失敗へ巻き込まない。
    query.batch = async (soqls, controls = {}) => {
        // 一項目の応答を保存してから次の項目を送る契約を維持する。
        if (!Array.isArray(soqls) || soqls.length !== 1)
            throw new Error('補完検索は一通信あたり1項目で指定してください。');
        // SOQLをシェル引数へ展開せず、既存の一時ディレクトリへ保存する。
        const file = path.join(directory, 'supplement-query.soql');
        // 読み取り専用クエリだけを保存し、取得値は書き込まない。
        fs.writeFileSync(file, soqls[0], { mode: 0o600 });
        // 一項目のCLI失敗をその項目の結果として返す。
        try {
            // Describeと同じAPIバージョンを指定し、CLI標準のクエリ経路で取得する。
            const result = await invoke(
                ['data', 'query', '--file', file, '--target-org', targetOrg, '--api-version', apiPath.split('/v')[1]],
                controls
            );
            // LIMIT 1の成功・ゼロ件だけを受け付け、不完全な応答は値なしにしない。
            if (
                result?.done !== true ||
                ![0, 1].includes(result.totalSize) ||
                !Array.isArray(result.records) ||
                result.records.length !== result.totalSize
            )
                throw Object.assign(new Error('補完検索の応答が不完全です。'), { code: 'INVALID_QUERY_RESPONSE' });
            // 取得元IDと項目値は収集側でも検証する。
            return [{ result }];
        } catch (error) {
            // 次の項目を検索するか停止するかは、既存の原因別判定へ委ねる。
            return [{ error }];
        }
    };
    // 一括取得と個別補完の入口を収集処理へ返す。
    return query;
}

module.exports = { createQueryClient, RESPONSE_LIMIT };
