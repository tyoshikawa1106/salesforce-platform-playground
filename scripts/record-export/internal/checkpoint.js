// 用途: 完了した取得範囲を原子的に保存し、同じ組織・条件での再開に利用する。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// 未完成の書き込みを確定済みデータとして読み込ませない。
function saveJson(file, value) {
    // 再開時に残っていても安全に置き換えられる未確定ファイルへ書く。
    const temporary = `${file}.tmp`;
    // 保存をOSへ確定させてから公開する。
    const fd = fs.openSync(temporary, 'w', 0o600);
    // 書き込みエラーでもハンドルを閉じる。
    try {
        // 実値は権限を制限した再開フォルダ内だけへ保存する。
        fs.writeFileSync(fd, JSON.stringify(value));
        // 正常終了直後の中断でも確定済み範囲を失わないようにする。
        fs.fsyncSync(fd);
    } finally {
        // 公開前に書き込みハンドルを解放する。
        fs.closeSync(fd);
    }
    // 同一ファイルシステム内のrenameで不完全なJSONの公開を防ぐ。
    fs.renameSync(temporary, file);
}

// 実値やローカルパスをパーサーの例外へ含めない。
function readJson(file) {
    // 破損したチェックポイントを読み飛ばさない。
    try {
        // このモジュールが保存したUTF-8形式を読み込む。
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        // 完了位置を推測して続行せず停止する。
        throw new Error('再開用データを読み込めません。再開フォルダを確認してください。');
    }
}

// 再開元の共有・並行実行を防ぎ、保存済み断片を順に復元する。
function openCheckpoint(directory, context, resume) {
    // 初回は既存の再開データを上書きしない。
    if (!resume) fs.mkdirSync(directory, { mode: 0o700 });
    // フォルダのない再開を新規取得として扱わない。
    if (!fs.statSync(directory).isDirectory()) throw new Error('再開フォルダがありません。');
    // 同じ再開元を複数プロセスで使わない。
    const lock = path.join(directory, 'lock.json');
    // 古いロックの確認・削除・再取得を一つの排他区間にする。
    const guard = path.join(directory, 'lock-acquire');
    // 別プロセスのロック回収に割り込まない。
    try {
        // mkdirの排他性で同時再開の勝者を一つに限定する。
        fs.mkdirSync(guard, { mode: 0o700 });
    } catch (error) {
        // この短い区間で強制終了した場合は自動解除せず、確認を求める。
        if (error.code === 'EEXIST')
            throw new Error(
                '再開ロックを取得中です。再実行しても続く場合は、同じ出力先の全処理が終了したことを確認し、再開フォルダ内のlock-acquire空フォルダだけを削除してください。'
            );
        // ディスクなどの別の原因はそのまま通知する。
        throw error;
    }
    // ロック確認に失敗しても、今回確保した排他区間は解放する。
    try {
        // 強制終了後のロックは同じPCでプロセスの終了を確認できた場合だけ解除する。
        if (fs.existsSync(lock)) {
            // ホストとPID以外の認証情報をロックへ保存しない。
            const owner = readJson(lock);
            // 別PCの稼働状態は推測しない。
            if (owner.host !== os.hostname() || !Number.isSafeInteger(owner.pid) || owner.pid < 1)
                throw new Error('再開データは別の実行で使用中、またはロックを確認できません。');
            // PIDが存在する場合は生存中として扱う。
            try {
                // 終了シグナルではなく存在確認だけを行う。
                process.kill(owner.pid, 0);
                // 同じプロセスからの二重起動も禁止する。
                throw new Error('再開データは別の実行で使用中です。');
            } catch (error) {
                // 権限不足などを終了済みと誤判定しない。
                if (error.code !== 'ESRCH') throw error;
            }
            // 終了を確認した古いロックだけを除去する。
            fs.unlinkSync(lock);
        }
        // 排他区間内で次の実行の所有権を確定する。
        fs.writeFileSync(lock, JSON.stringify({ host: os.hostname(), pid: process.pid }), { flag: 'wx', mode: 0o600 });
    } finally {
        // データや実行中ロックには触れず、取得操作だけのガードを外す。
        fs.rmdirSync(guard);
    }
    // 確定した断片の件数を次のファイル名へ使う。
    let sequence = 0;
    // レコードごとの保存済み項目数だけをメモリへ保持する。
    const offsets = new Map();
    // 保留した項目だけを最後の再試行で置換可能にする。
    const pending = new Set();
    // 対象IDは初回の選択を固定して使う。
    let selected = null;
    // 初期化中の失敗でも取得したロックを解放する。
    try {
        // 取得条件と対象選択を別々に確定できるようにする。
        const metadata = path.join(directory, 'context.json');
        // 同じオブジェクト・ユーザー・項目順・レコードタイプだけを許可する。
        if (resume) {
            // 条件を変えた再開による別データの混入を防ぐ。
            if (JSON.stringify(readJson(metadata)) !== JSON.stringify(context))
                throw new Error(
                    '再開元と組織・実行ユーザー・取得条件・項目定義が一致しません。元の条件で再実行してください。'
                );
        } else {
            // 認証トークンは保存せず、接続の識別情報と取得条件だけ保存する。
            saveJson(metadata, context);
        }
        // 対象選択の完了前に止まっていれば初回選択からやり直せる。
        const selectedFile = path.join(directory, 'selected.json');
        // 選択済みの場合だけ、最新レコードの選び直しを禁止する。
        if (fs.existsSync(selectedFile)) {
            // 不正なIDをSOQLへ展開する前に検証する。
            selected = readJson(selectedFile);
            // 件数と一意性もチェックする。
            if (
                !Array.isArray(selected) ||
                selected.length > context.recordLimit ||
                selected.some((row) => !/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(row?.Id)) ||
                new Set(selected.map((row) => row.Id)).size !== selected.length
            )
                throw new Error('再開用の対象レコード情報が不正です。');
        }
    } catch (error) {
        // 他の実行のロックには触れず、今回取得したものだけを外す。
        fs.unlinkSync(lock);
        // 不一致や破損では検索を開始しない。
        throw error;
    }
    // 新規選択した対象だけを原子的に確定する。
    function select(rows) {
        // 対象選択は一度だけ記録する。
        if (selected !== null) return;
        // 作成日時を含む固定された選択順を維持する。
        saveJson(path.join(directory, 'selected.json'), rows);
        // 後続の断片検証へ同じ集合を渡す。
        selected = rows;
    }
    // 保存済み断片は一件ずつ読み、CSV退避領域を再構築する。
    async function replay(append) {
        // 未確定の.tmpは対象にせず、確定した連番だけ読む。
        const chunks = fs
            .readdirSync(directory)
            .filter((name) => /^chunk-\d{8}\.json$/.test(name))
            .sort();
        // 選択前に断片がある状態は不正として停止する。
        const ids = new Set((selected || []).map((row) => row.Id));
        // 一度に保持する実値は一断片に限定する。
        for (const filename of chunks) {
            // 連番の欠落を部分取得として隠さない。
            if (filename !== `chunk-${String(sequence).padStart(8, '0')}.json`)
                throw new Error('再開用データに欠落があります。');
            // 保存済みの値と取得元を復元する。
            const chunk = readJson(path.join(directory, filename));
            // レコードIDと項目範囲を保存済みの取得条件で検証する。
            if (
                !ids.has(chunk.id) ||
                (!chunk.update?.replace && chunk.offset !== (offsets.get(chunk.id) || 0)) ||
                !Number.isSafeInteger(chunk.offset) ||
                chunk.offset < 0 ||
                !Number.isSafeInteger(chunk.count) ||
                chunk.count < 1 ||
                chunk.offset + chunk.count > context.fields.length ||
                !Array.isArray(chunk.sources) ||
                !chunk.record ||
                chunk.record.Id !== chunk.id
            )
                throw new Error('再開用データのレコードまたは項目範囲が不正です。');
            // 断片に含まれるべき全項目の存在を検査する。
            const group = context.fields.slice(chunk.offset, chunk.offset + chunk.count);
            // 欠落は空欄に変換しない。
            if (group.some((field) => !Object.hasOwn(chunk.record, field.name)))
                throw new Error('再開用データに項目値の欠落があります。');
            // 新形式の補完状態は項目範囲と固定形式を検査し、旧形式の省略は許可する。
            if (
                chunk.statuses !== undefined &&
                (!Array.isArray(chunk.statuses) ||
                    chunk.statuses.some(
                        (entry) =>
                            !Array.isArray(entry) ||
                            entry.length !== 2 ||
                            !group.some((field) => field.name === entry[0]) ||
                            typeof entry[1] !== 'string' ||
                            !/^(?:SKIPPED|PENDING_RETRY)_[A-Z][A-Z0-9_]{0,79}$/.test(entry[1])
                    ))
            )
                throw new Error('再開用データの補完状態が不正です。');
            // 後日追加された置換情報も検証し、完了項目を勝手に上書きしない。
            if (
                chunk.update &&
                (typeof chunk.update !== 'object' ||
                    (chunk.update.replace !== undefined && chunk.update.replace !== true) ||
                    (chunk.update.retryBatchSize !== undefined &&
                        (!Number.isSafeInteger(chunk.update.retryBatchSize) || chunk.update.retryBatchSize < 1)))
            )
                throw new Error('再開用データの再試行条件が不正です。');
            // 置換はプレビューの保留済み一項目に限定する。
            if (
                chunk.update?.replace &&
                (context.mode !== 'record-fields-preview' || group.length !== 1 || !pending.has(group[0].name))
            )
                throw new Error('再開用データの置換対象が不正です。');
            // 保留状態には再試行サイズが必要になる。
            if (
                (chunk.statuses || []).some(([, status]) => status.startsWith('PENDING_RETRY_')) &&
                !chunk.update?.retryBatchSize
            )
                throw new Error('再開用データの再試行サイズがありません。');
            // 元の項目順でCSVを再構築する。
            await append(
                chunk.id,
                group,
                chunk.record,
                new Map(chunk.sources),
                selected[0]?.Id || '',
                new Map(chunk.statuses || []),
                chunk.update
            );
            // 復元できた範囲だけを完了扱いにする。
            if (!chunk.update?.replace) offsets.set(chunk.id, chunk.offset + chunk.count);
            // 最新の確定状態に合わせて置換可能な項目を管理する。
            for (const field of group) {
                // 保留から成功・スキップへ変わった項目は再置換しない。
                pending.delete(field.name);
                // 未処理の保留だけを残す。
                if (new Map(chunk.statuses || []).get(field.name)?.startsWith('PENDING_RETRY_'))
                    pending.add(field.name);
            }
            // 次の確定断片を確認する。
            sequence++;
        }
    }
    // 完了した取得範囲を一断片として保存する。
    function append(id, group, record, sources, _latestId, statuses, update) {
        // 前の項目範囲との連続性を確認する。
        const offset = update?.replace
            ? context.fields.findIndex((field) => field.name === group[0]?.name)
            : offsets.get(id) || 0;
        // 取得順の追記とは別に、保留済みプレビュー行の置換だけを許可する。
        if (
            update?.replace &&
            (context.mode !== 'record-fields-preview' || group.length !== 1 || !pending.has(group[0].name))
        )
            throw new Error('再開用データの置換対象が不正です。');
        // 表示やクエリ応答順によらず指定位置を保持する。
        if (group.some((field, i) => context.fields[offset + i]?.name !== field.name))
            throw new Error('再開用データの項目順が一致しません。');
        // 取得範囲に含まれない値を重複して保存しない。
        const values = Object.fromEntries(group.map((field) => [field.name, record[field.name]]));
        // レコードの照合に必要なIDは必ず含める。
        values.Id = id;
        // ファイルが確定するまで完了位置を進めない。
        saveJson(path.join(directory, `chunk-${String(sequence).padStart(8, '0')}.json`), {
            id,
            update,
            offset,
            count: group.length,
            record: values,
            sources: group.map((field) => [field.name, sources?.get(field.name) || '']),
            // 古い再開記録にない追加情報は省略可能にし、互換性を保つ。
            statuses: group
                .filter((field) => statuses?.has(field.name))
                .map((field) => [field.name, statuses.get(field.name)])
        });
        // 再実行で同じ項目を取得しないための境界を更新する。
        if (!update?.replace) offsets.set(id, offset + group.length);
        // 途中停止しても、同じ保留行を重複して再処理しない。
        for (const field of group) {
            // 確定した再試行結果では保留を解除する。
            pending.delete(field.name);
            // 初回の保留だけを置換候補にする。
            if (statuses?.get(field.name)?.startsWith('PENDING_RETRY_')) pending.add(field.name);
        }
        // 次の断片は別ファイルに保存する。
        sequence++;
    }
    // 実行終了時にロックだけを解除し、データは正常終了まで残す。
    function close() {
        // 通常エラー時も次の実行で再開できるようにする。
        fs.unlinkSync(lock);
    }
    // ファイルの実値を公開せず、再開に必要な操作だけを返す。
    return {
        get selected() {
            return selected;
        },
        offsets,
        select,
        replay,
        append,
        close
    };
}

module.exports = { openCheckpoint };
