// 用途: 既存認証のCLIでComposite Queryを実行し、応答完了と各ページの整合性を確認する。
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
    // 逐次実行専用のリクエストとレスポンスの保存先を固定する。
    const requestFile = path.join(directory, 'query-request.json');
    // APIエラーは固定コードだけを表示し、レコード値や生本文を漏らさない。
    function fail(code) {
        // 自動分割してよい原因を明示的に分類する。
        const allowed = [...QUERY_ERROR_CODES, 'QUERY_TOO_COMPLICATED', 'INVALID_SESSION_ID'];
        // 未知のエラー本文は表示しない。
        const safeCode = allowed.includes(code) ? code : 'QUERY_FAILED';
        // 呼び出し元は原因に応じて分割または停止する。
        throw Object.assign(
            new Error(
                QUERY_TIMEOUT_CODES.includes(safeCode)
                    ? `Salesforce側で検索がタイムアウトしました (${safeCode})。検索条件・クエリプランを確認してください。`
                    : `検索に失敗しました (${safeCode})。`
            ),
            { code: safeCode }
        );
    }
    // クエリ全体の応答量に上限を設け、ページを無制限に蓄積しない。
    return async function query(soql, controls = {}) {
        // Query Moreも同じCompositeの読み取りサブリクエストとして送信する。
        let url = `${apiPath}/query/?q=${encodeURIComponent(soql)}`;
        // 全ページのレコードを上限内に限って保持する。
        const records = [];
        // 生のJSONサイズを合計し、JSオブジェクト化前に制限する。
        let bytes = 0;
        // 最初に返された総件数が途中で変化しないことを確認する。
        let total;
        // 同じページを反復する異常応答を検知する。
        const visited = new Set();
        // Query Moreがある間だけ続行する。
        while (url) {
            // レコード値ではなくクエリだけをPOST本文へ書く。
            fs.writeFileSync(
                requestFile,
                JSON.stringify({ compositeRequest: [{ method: 'GET', url, referenceId: 'records' }] }),
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
            // CLIの標準出力上限に加え、ページをまたいだ保持量も制限する。
            const body = response?.body;
            // 正常なHTTP応答でも空本文や文字列を検索成功としない。
            if (!body || typeof body !== 'object') fail();
            // CLIはページ単位で返すため、全件の自動蓄積は行わない。
            bytes += Buffer.byteLength(JSON.stringify(body), 'utf8');
            // 合計サイズ超過は既存の分割処理へ渡す。
            if (bytes > RESPONSE_LIMIT)
                throw Object.assign(new Error('検索結果が応答サイズ上限を超えました。'), { code: 'BUFFER_LIMIT' });
            // HTTPエラーを正常なページとして処理しない。
            if (response.statusCode !== 200) fail(Array.isArray(body) ? body[0]?.errorCode : undefined);
            // Composite自体のAPIエラーを確認する。
            if (Array.isArray(body)) fail(body[0]?.errorCode);
            // 必ず要求した単一の応答を受け取る。
            const part = body?.compositeResponse?.[0];
            // サブリクエストのHTTP失敗もCLIの終了コードとは別に検証する。
            if (
                body?.compositeResponse?.length !== 1 ||
                part?.referenceId !== 'records' ||
                part.httpStatusCode !== 200
            ) {
                // エラーメッセージではなく固定のコードだけを取り出す。
                fail(part?.body?.[0]?.errorCode);
            }
            // クエリ応答の基本構造を検証する。
            const page = part.body;
            // ページごとのtotalSizeは全体件数であり、レコード数とは別に扱う。
            if (
                !Array.isArray(page?.records) ||
                typeof page.done !== 'boolean' ||
                !Number.isSafeInteger(page.totalSize) ||
                page.totalSize < 0
            )
                fail();
            // 初回だけ総件数を確定する。
            total ??= page.totalSize;
            // 不整合なページを連結しない。
            if (total !== page.totalSize || (!page.done && !page.records.length)) fail();
            // 大量配列を引数展開せず追加する。
            for (const record of page.records) records.push(record);
            // 最終ページでは件数が揃ったことを確認する。
            if (page.done) {
                // 中途半端な結果を出力しない。
                if (records.length !== total) fail();
                // 収集処理へ完全な応答として返す。
                return { records, totalSize: total, done: true };
            }
            // API応答から任意URLへアクセスしないようQuery Moreの相対パスだけを許可する。
            if (
                !/^\/services\/data\/v\d+\.\d+\/query\/[A-Za-z0-9-]+$/.test(page.nextRecordsUrl) ||
                visited.has(page.nextRecordsUrl)
            )
                fail();
            // 次ページの重複を検知する。
            visited.add(page.nextRecordsUrl);
            // 次のAPIページへ進める。
            url = page.nextRecordsUrl;
        }
    };
}

module.exports = { createQueryClient, RESPONSE_LIMIT };
