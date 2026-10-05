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
    searchBatch,
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
    // 確定済み項目には再問い合わせせず、最大5項目の結果を共有する。
    return async function resolve(field) {
        // 保留・値なし・値ありのいずれも確定後はキャッシュから返す。
        if (!resolved.has(field.name)) {
            // 未確定の対象だけを指定順で最大5項目に絞る。
            const pending = missing.filter((candidate) => !resolved.has(candidate.name)).slice(0, retry ? 1 : 5);
            // 対象範囲外の呼び出しを値なしと誤認しない。
            if (!pending.some((candidate) => candidate.name === field.name))
                throw new Error('補完対象の項目範囲が一致しません。');
            // 応答のない通信を待ち続けず、失敗範囲は最後に個別再試行する。
            const started = performance.now();
            // 同じ通信に含まれる最大5検索の待ち時間を制限する。
            const deadline = started + SUPPLEMENT_TIMEOUT_MS;
            // 実行位置はサーバーから通知されないため、送信した対象項目を正確に表示する。
            const label = `${retry ? '最後の再試行' : '個別非NULL検索'}：${pending.length}項目（${pending.map((item) => item.name).join(', ')}）・各最大1件`;
            // 一項目だけを取得中と誤解させず、今回の送信対象を通知する。
            report(field, label);
            // 通信待ち中も経過時間を表示し、処理停止との区別を可能にする。
            const timer = setInterval(
                () =>
                    report(
                        field,
                        `${label} / 応答待ち：${((performance.now() - started) / 1000).toFixed(0)}秒経過・残り上限${Math.max(0, Math.ceil((deadline - performance.now()) / 1000))}秒`
                    ),
                10000
            );
            // 通信全体の失敗と、各検索が返した失敗を同じ項目別処理へ渡す。
            let outcomes;
            // 応答の取得が終わるまで次のグループを送らない。
            try {
                // SOQLは独立させたまま、通信とCLI起動だけをまとめる。
                outcomes = await searchBatch(pending, scope, { deadline });
            } catch (error) {
                // 通信失敗ではどの検索が完了したか不明なので、値なしと確定しない。
                outcomes = pending.map(() => ({ error }));
            } finally {
                // 成功・失敗のどちらでも待機表示を終了する。
                clearInterval(timer);
            }
            // 診断済みの同一エラーを最大5回繰り返し表示しない。
            const reported = new Set();
            // 他項目の成功・失敗を混ぜず、項目名をキーに確定結果を保存する。
            pending.forEach((candidate, index) => {
                // 各応答は収集側で件数・ID・項目の完全性を検証済み。
                const outcome = outcomes[index];
                // 個別エラーがあっても正常な他項目の値を保持する。
                if (outcome.error) {
                    // 認証・保存・不正応答などの致命的な失敗は該当項目の順番で停止する。
                    if (!SKIPPABLE_CODES.has(outcome.error.code)) {
                        // 項目順で保存済みの結果までを再開可能な状態へ残す。
                        resolved.set(candidate.name, { error: outcome.error });
                        // スキップ可能な失敗へ変換しない。
                        return;
                    }
                    // 生の本文を含めず、安全化された診断だけを表示する。
                    if (outcome.error.diagnostic && !reported.has(outcome.error)) {
                        // 詳細は一通信について一度だけ表示する。
                        report(field, `${outcome.error.code} / ${outcome.error.diagnostic}`);
                        // 同じ通信エラーが後続項目に出ても重複表示しない。
                        reported.add(outcome.error);
                    }
                    // 失敗した項目だけを最後に個別で一度再試行する。
                    resolved.set(candidate.name, {
                        skipped: outcome.error.code,
                        deferred: !retry,
                        retryBatchSize: 1,
                        elapsedSeconds: ((performance.now() - started) / 1000).toFixed(1)
                    });
                    // エラーを正常な値なしに置き換えない。
                    return;
                }
                // 非NULL条件に一致した先頭レコードだけを採用する。
                const row = outcome.rows[0];
                // レコードがあるのに値がない応答を正常扱いしない。
                if (row && !hasValue(row[candidate.name])) {
                    // 矛盾した応答は再問い合わせせず、再開情報を残して停止する。
                    resolved.set(candidate.name, { error: new Error('非NULL検索の応答に補完可能な値がありません。') });
                    // 未確認の値をCSVへ入れない。
                    return;
                }
                // ゼロ件の検索結果だけを値なしとして確定し、次回の対象から外す。
                resolved.set(candidate.name, row ? { value: row[candidate.name], source: row.Id } : null);
            });
            // 返された検索結果数を通知し、レコードの実値は表示しない。
            report(field, `検索完了：${pending.length}項目・${((performance.now() - started) / 1000).toFixed(1)}秒`);
        }
        // 項目の指定順で失敗を通知し、それ以前の確定結果を保存できるようにする。
        const result = resolved.get(field.name);
        // 全体停止が必要な失敗をスキップで隠さない。
        if (result?.error) throw result.error;
        // 空欄はnull、実値があれば値と取得元IDを返す。
        return result;
    };
}

module.exports = { createPreviewResolver, SUPPLEMENT_TIMEOUT_MS };
