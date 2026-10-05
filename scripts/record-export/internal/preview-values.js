// 用途: 空欄の補完候補をまとめて取得し、項目順の確定処理へ最新の実値だけを渡す。

const { QUERY_TIMEOUT_CODES } = require('./error-definitions');

// 応答のない一回の検索を制限し、成功が続く補完全体は時間だけで打ち切らない。
const SUPPLEMENT_TIMEOUT_MS = 60000;

// 補完だけの失敗は元レコードを保持して続行し、認証・API利用上限などは停止する。
const SKIPPABLE_CODES = new Set([
    ...QUERY_TIMEOUT_CODES,
    'CLI_TIMEOUT',
    'SUPPLEMENT_TIMEOUT',
    'NETWORK_TIMEOUT',
    'NETWORK_ERROR',
    'CLI_FAILED',
    'QUERY_FAILED',
    'INVALID_FIELD',
    'INSUFFICIENT_ACCESS',
    'MALFORMED_QUERY',
    'INVALID_QUERY_FILTER_OPERATOR',
    'QUERY_LENGTH_LIMIT',
    'QUERY_TOO_COMPLICATED',
    'BUFFER_LIMIT'
]);

// 取得した値と、利用者へ結果を確定する順序を分離する。
function createPreviewResolver({
    fields,
    record,
    scope,
    search,
    hasValue,
    canFilterNonNull,
    report = () => {},
    retry = false
}) {
    // 補完しない項目や元から値のある項目を追加検索へ含めない。
    const missing = fields.filter(
        (field) => !field.invalid && !hasValue(record[field.name]) && canFilterNonNull(field)
    );
    // 項目名ごとに最初に見つかった最新値だけを保持する。
    const resolved = new Map();
    // 元レコードや出力順は変更せず、候補だけを採用する。
    function adopt(rows, pending) {
        // 検索応答はCreatedDate・Idの降順であり、最初の実値を優先する。
        for (const row of rows) {
            // 後続行の古い値で上書きしない。
            for (const field of pending) {
                // falseと0も有効な補完値として扱う。
                if (!resolved.has(field.name) && hasValue(row[field.name]))
                    resolved.set(field.name, { value: row[field.name], source: row.Id });
            }
        }
    }
    // 呼び出された項目が確定するまでだけ検索し、表示と保存は呼び出し元へ任せる。
    return async function resolve(field) {
        // 後の項目を先に見つけても、この項目の順番になるまで返さない。
        while (!resolved.has(field.name)) {
            // 対象外の項目を誤って値なしとしない。
            if (!missing.some((candidate) => candidate.name === field.name))
                throw new Error('補完対象の項目範囲が一致しません。');
            // すでに値を確保した項目はSELECTとOR条件の両方から外す。
            const pending = missing.filter((candidate) => !resolved.has(candidate.name));
            // OR条件は括弧で囲み、レコードタイプ条件を全項目へ適用する。
            const predicate = pending.map((candidate) => `${candidate.name} != NULL`).join(' OR ');
            // 単一項目は従来と同じSOQLにする。
            const conditions = [...scope, pending.length === 1 ? predicate : `(${predicate})`];
            // 項目が減るたびに新しい検索とし、その検索のページ取得だけで期限を共有する。
            const deadline = performance.now() + SUPPLEMENT_TIMEOUT_MS;
            // 検索切り替え時に一括検索の対象範囲と待機上限を通知する。
            report(
                field,
                `${retry ? '最後の再試行' : '空欄項目の一括非NULL検索'}：対象${pending.length}項目・最大1レコード・残り上限${Math.max(0, Math.ceil((deadline - performance.now()) / 1000))}秒`
            );
            // 取得した行数とは別に、クエリの実測時間を記録する。
            const started = performance.now();
            // 応答待ち中にも対象項目と経過時間を表示する。
            const timer = setInterval(
                () =>
                    report(
                        field,
                        `応答待ち：${((performance.now() - started) / 1000).toFixed(0)}秒経過・残り上限${Math.max(0, Math.ceil((deadline - performance.now()) / 1000))}秒`
                    ),
                10000
            );
            // 制限による失敗だけを狭い範囲で再実行する。
            let rows;
            // 認証や通信の失敗を再分割して繰り返さない。
            try {
                // キャッシュ探索や分割を含め、期限後に新しいCLIを起動しない。
                if (performance.now() >= deadline)
                    throw Object.assign(new Error('補完の待機上限に達しました。'), { code: 'SUPPLEMENT_TIMEOUT' });
                // 取得順はすべて最新順、検索自体は逐次実行を維持する。
                rows = await search(['Id', ...pending.map((candidate) => candidate.name)], conditions, 1, true, {
                    deadline
                });
            } catch (error) {
                // 認証・保存など処理を続けられない障害は、保留で隠さない。
                if (!SKIPPABLE_CODES.has(error.code)) throw error;
                // 診断生成側で安全化した構造だけを通知する。
                if (error.diagnostic) report(field, `${error.code} / ${error.diagnostic}`);
                // 初回は後回しにし、最後の再試行で失敗した場合だけスキップを確定する。
                for (const candidate of pending)
                    resolved.set(candidate.name, {
                        skipped: error.code,
                        deferred: !retry,
                        retryBatchSize: Math.max(1, Math.ceil(pending.length / 2)),
                        elapsedSeconds: ((performance.now() - started) / 1000).toFixed(1)
                    });
                // その場で分割を繰り返さず、呼び出し元の保存と後続処理へ戻る。
                break;
            } finally {
                // 成功・スキップ・例外のどの経路でも定期表示を解除する。
                clearInterval(timer);
            }
            // 応答が返ったことを結果の値を含めず通知する。
            report(field, `検索完了：${rows.length}レコード・${((performance.now() - started) / 1000).toFixed(1)}秒`);
            // 応答から複数項目を補完しても、保存順は変更しない。
            adopt(rows, pending);
            // 検索結果ゼロの場合だけ、残項目を値なしと確定する。
            if (!rows.length) {
                // OR条件でゼロ件なら残った全項目に非NULL値がない。
                for (const candidate of pending) resolved.set(candidate.name, null);
            } else if (!pending.some((candidate) => resolved.has(candidate.name))) {
                // 同じ応答を無限に再検索せず、条件と矛盾した応答で停止する。
                throw new Error('非NULL検索の応答に補完可能な値がありません。');
            }
        }
        // 空欄はnull、実値があれば値と取得元IDを返す。
        return resolved.get(field.name);
    };
}

module.exports = { createPreviewResolver, SUPPLEMENT_TIMEOUT_MS };
