// 用途: 既存認証のCLIでComposite Queryを実行し、URL長と応答蓄積の制限を避ける。
const fs = require('node:fs');
const path = require('node:path');
const RESPONSE_LIMIT = 64 * 1024 * 1024;

// 長いSOQLをURL引数ではなくPOST本文に格納し、読み取りだけを実行する。
function createQueryClient(directory, targetOrg, invoke, sobjectUrl) {
    // Describeが返した相対パスからバージョンだけを取り出し、項目定義と検索を一致させる。
    const apiPath = /^([/]services[/]data[/]v\d+[.]\d+)[/]sobjects[/][A-Za-z][A-Za-z0-9_]*$/.exec(sobjectUrl)?.[1];
    // バージョン不明時に古いAPIへフォールバックして項目を欠落させない。
    if (!apiPath) throw new Error('Describeから検索用APIバージョンを確認できませんでした。');
    // 逐次実行専用のリクエストとレスポンスの保存先を固定する。
    const requestFile = path.join(directory, 'query-request.json');
    // 取得値は権限を制限した一時ディレクトリ内だけへ保存する。
    const responseFile = path.join(directory, 'query-response.json');
    // APIエラーは固定コードだけを表示し、レコード値や生本文を漏らさない。
    function fail(code) {
        // 自動分割してよい原因を明示的に分類する。
        const allowed = [
            'QUERY_TOO_COMPLICATED',
            'INVALID_FIELD',
            'MALFORMED_QUERY',
            'INVALID_QUERY_FILTER_OPERATOR',
            'INSUFFICIENT_ACCESS',
            'REQUEST_LIMIT_EXCEEDED',
            'INVALID_SESSION_ID',
            'QUERY_TIMEOUT',
            'REQUEST_RUNNING_TOO_LONG'
        ];
        // 未知のエラー本文は表示しない。
        const safeCode = allowed.includes(code) ? code : 'QUERY_FAILED';
        // 呼び出し元は原因に応じて分割または停止する。
        throw Object.assign(
            new Error(
                ['QUERY_TIMEOUT', 'REQUEST_RUNNING_TOO_LONG'].includes(safeCode)
                    ? `Salesforce側で検索がタイムアウトしました (${safeCode})。検索条件・クエリプランを確認してください。`
                    : `検索に失敗しました (${safeCode})。`
            ),
            { code: safeCode }
        );
    }
    // クエリ全体の応答量に上限を設け、ページを無制限に蓄積しない。
    return async function query(soql) {
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
            // 前回の結果を誤って再利用しない。
            fs.rmSync(responseFile, { force: true });
            // ストリーム先の権限をCLI起動前に制限する。
            fs.writeFileSync(responseFile, '', { mode: 0o600, flag: 'wx' });
            // CLI自体にレスポンスをファイルへ流させ、stdoutには値をためない。
            await invoke([
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
                '--stream-to-file',
                responseFile,
                '--target-org',
                targetOrg
            ]);
            // 読み込み前にファイルの実サイズを確認する。
            bytes += fs.statSync(responseFile).size;
            // 大きすぎる結果は破棄し、収集側でID集合や項目を縮小する。
            if (bytes > RESPONSE_LIMIT) {
                // サイズ制限だけを再分割対象として通知する。
                throw Object.assign(new Error('検索結果が応答サイズ上限を超えました。'), { code: 'BUFFER_LIMIT' });
            }
            // 不正なJSONでも本文を例外に含めない。
            let body;
            // JSONパーサーの例外に実値が含まれることを防ぐ。
            try {
                // 上限を満たすページだけを解析する。
                body = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
            } catch {
                // 構造化されていない応答は成功扱いしない。
                fail();
            }
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
