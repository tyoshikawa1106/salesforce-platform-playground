// 用途: 空欄の補完候補をまとめて取得し、項目順の確定処理へ最新の実値だけを渡す。

const { QUERY_TIMEOUT_CODES } = require('./error-definitions');

// 出力量を限定し、値のない項目のために全レコードを走査しない。
const RECENT_RECORD_LIMIT = 200;

// 先読みした値と、利用者へ結果を確定する順序を分離する。
function createPreviewResolver({ fields, record, scope, search, hasValue, canFilterNonNull }) {
    // 補完しない項目や元から値のある項目を追加検索へ含めない。
    const missing = fields.filter(
        (field) => !field.invalid && !hasValue(record[field.name]) && canFilterNonNull(field)
    );
    // 分割は指定順の連続範囲に限定する。
    const groups = [{ fields: missing, sampled: missing.length < 2, limit: RECENT_RECORD_LIMIT }];
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
            // 未完了の現在項目を含む範囲だけを処理する。
            const index = groups.findIndex((group) => group.fields.some((candidate) => candidate.name === field.name));
            // 呼び出し元の補完条件との不一致を値なしとして隠さない。
            if (index < 0) throw new Error('補完対象の項目範囲が一致しません。');
            // すでに値を確保した項目はSELECTとOR条件の両方から外す。
            const group = groups[index];
            // 配列の元の順序はfilter後も維持する。
            const pending = group.fields.filter((candidate) => !resolved.has(candidate.name));
            // 直近取得は非NULL条件を使わず、新しい範囲だけをまとめて読む。
            const recent = !group.sampled;
            // OR条件は括弧で囲み、レコードタイプ条件を全項目へ適用する。
            const predicate = pending.map((candidate) => `${candidate.name} != NULL`).join(' OR ');
            // 単一項目は従来と同じSOQLにする。
            const conditions = recent ? scope : [...scope, pending.length === 1 ? predicate : `(${predicate})`];
            // 制限による失敗だけを狭い範囲で再実行する。
            let rows;
            // 認証や通信の失敗を再分割して繰り返さない。
            try {
                // 取得順はすべて最新順、検索自体は逐次実行を維持する。
                rows = await search(
                    ['Id', ...pending.map((candidate) => candidate.name)],
                    conditions,
                    recent ? group.limit : 1
                );
            } catch (error) {
                // 直近取得のサイズ超過時は、項目を分ける前に件数を縮める。
                if (recent && error.code === 'BUFFER_LIMIT' && group.limit > 1) {
                    // 成功するまで必ず応答量の上限を縮める。
                    group.limit = Math.ceil(group.limit / 2);
                    // 同じ順序のまま縮小した範囲を再取得する。
                    continue;
                }
                // ORが大きすぎる場合は、連続する項目範囲へ分割する。
                const splittable = [
                    'QUERY_LENGTH_LIMIT',
                    'QUERY_TOO_COMPLICATED',
                    'BUFFER_LIMIT',
                    ...QUERY_TIMEOUT_CODES,
                    'CLI_TIMEOUT'
                ].includes(error.code);
                // 一項目の失敗や通信障害は停止して再開記録を保持する。
                if (!splittable || pending.length < 2) throw error;
                // 先頭側から処理できるよう分割順を固定する。
                const middle = Math.ceil(pending.length / 2);
                // 直近取得を済ませた範囲は、分割後に同じ先読みを繰り返さない。
                groups.splice(
                    index,
                    1,
                    { ...group, fields: pending.slice(0, middle) },
                    { ...group, fields: pending.slice(middle) }
                );
                // 現在項目を含む範囲へ戻り、後続範囲を先に検索しない。
                continue;
            }
            // 応答から複数項目を補完しても、保存順は変更しない。
            adopt(rows, pending);
            // 最新順の限定取得は各範囲で一度だけ行う。
            if (recent) {
                // 次は残項目だけをOR検索する。
                group.sampled = true;
                // 上限未満なら参照可能な全行を確認済みなので追加検索は不要。
                if (rows.length < group.limit)
                    for (const candidate of pending)
                        if (!resolved.has(candidate.name)) resolved.set(candidate.name, null);
            } else if (!rows.length) {
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

module.exports = { createPreviewResolver, RECENT_RECORD_LIMIT };
