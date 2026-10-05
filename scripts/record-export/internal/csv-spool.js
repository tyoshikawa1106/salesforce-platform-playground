// 用途: 分割結果をIDごとの一時CSVへ退避し、指定順で完成ファイルを確定する。
const fs = require('node:fs');
const path = require('node:path');
const { csv, toCsv } = require('./collector');

// 途中公開と完成時に、一定サイズのバッファだけでCSV断片をコピーする。
function copyContents(file, destination) {
    // 大きなレコードでもファイル全体を一度に読み込まない。
    const buffer = Buffer.alloc(64 * 1024);
    // 対象断片だけを読み取り専用で開く。
    const source = fs.openSync(file, 'r');
    // コピー失敗時にも読み取り資源を解放する。
    try {
        // EOFまで一定量ずつコピーする。
        let count;
        // 文字列化せずUTF-8やCSV内の改行をそのまま保持する。
        while ((count = fs.readSync(source, buffer, 0, buffer.length, null)) > 0) {
            // 部分書き込みでも全バイトが保存されるまで進める。
            let written = 0;
            // 端末やファイルシステムの書き込み単位に依存しない。
            while (written < count) {
                // 次に未保存のバイトから書き込む。
                const size = fs.writeSync(destination, buffer, written, count - written);
                // 進行しない書き込みで無限ループにしない。
                if (!size) throw new Error('CSVの書き込みが進行しませんでした。');
                // 実際に書けた分だけ進める。
                written += size;
            }
        }
    } finally {
        // 次レコードを開く前に閉じる。
        fs.closeSync(source);
    }
}

// 1応答分を超える値を保持せず、列の順序と完全性を保存時にも確認する。
function createCsvSpool(directory, fields, mode, partialOutput) {
    // 表計算ソフトでは完成CSVと区別できる名前で途中結果を公開する。
    let currentPartial = partialOutput ? path.join(directory, 'partial.csv') : undefined;
    // 再構築中に失敗しても前回の途中CSVを壊さない。
    if (currentPartial) fs.writeFileSync(currentPartial, toCsv({ fields, records: [] }, mode), { mode: 0o600 });
    // 横型は全項目が揃ったレコードだけを選択順で公開する。
    let publishedRows = 0;
    // レコード値ではなく、保存済み列数だけを保持する。
    const positions = new Map();
    // IDは収集処理で検証済みだが、ファイル名には連番だけを使う。
    const files = new Map();
    // 縦型は項目別断片を使い、最後の再試行で元の行だけ置き換える。
    const previewFiles = new Map();
    // 途中CSVの再公開は再試行範囲の終わりにまとめる。
    let previewDirty = false;
    // クエリの応答順と出力順を分離して保存する。
    function append(id, group, record, sources, latestId, statuses, update) {
        // 各レコードで次に来る項目の位置を求める。
        const offset = update?.replace
            ? fields.findIndex((field) => field.name === group[0]?.name)
            : positions.get(id) || 0;
        // 置換は保存済みの縦型一項目に限定する。
        if (update?.replace && (mode !== 'record-fields-preview' || group.length !== 1 || !previewFiles.has(offset)))
            throw new Error('CSVの置換対象が不正です。');
        // 再分割の重複や欠落を誤ったCSVとして確定しない。
        if (group.some((field, index) => fields[offset + index]?.name !== field.name)) {
            // 値を含めず、順序違反として停止する。
            throw new Error('分割取得した項目の順序または範囲が一致しません。');
        }
        // 初めて取得したIDに専用の一時ファイルを割り当てる。
        if (!files.has(id)) {
            // API由来の文字列をファイルパスに使用しない。
            files.set(id, path.join(directory, `row-${files.size}.csv`));
        }
        // 縦型は元の指定位置をファイル名に使い、取得順と公開順を分離する。
        if (mode === 'record-fields-preview') {
            // テストや旧再開記録で複数項目の断片が渡されても、一項目ずつ保持する。
            for (let index = 0; index < group.length; index++) {
                // ステータスと補完元を含む一行だけを生成する。
                const text = toCsv(
                    { fields: [group[index]], records: [record], sources, latestId, statuses },
                    mode
                ).slice('FieldApiName,Label,Type,Value,Status,SourceRecordId\r\n'.length);
                // 利用者のAPI名をパスへ使わず指定位置だけを使う。
                const file = path.join(directory, `field-${offset + index}.csv`);
                // 完成ファイルはチェックポイントから復元可能な断片だけで組み立てる。
                fs.writeFileSync(file, text, { mode: 0o600, flag: update?.replace ? 'w' : 'wx' });
                // 連結時に指定順で参照できるよう保持する。
                previewFiles.set(offset + index, file);
                // 初回の追記はすぐ公開し、置換は範囲完了時にまとめて公開する。
                if (partialOutput && !update?.replace) fs.appendFileSync(currentPartial, text);
            }
            // 最後の再試行で行を置換した場合だけ再構築を必要にする。
            if (update?.replace) previewDirty = true;
        } else {
            // 横型は従来どおりレコード別に指定列を追記する。
            const text = `${offset ? ',' : ''}${group.map((field) => csv(record[field.name])).join(',')}`;
            // 大量データを全件メモリへ蓄積しない。
            fs.writeFileSync(files.get(id), text, { flag: offset ? 'a' : 'wx', mode: 0o600 });
        }
        // 置換では初回処理の完了位置を戻さない。
        if (!update?.replace) positions.set(id, offset + group.length);
    }
    // 保存済み断片を完全に復元した後で、途中CSVの公開先へ切り替える。
    function activatePartial() {
        // 通常の一時退避だけを使う呼び出しでは何もしない。
        if (!partialOutput) return;
        // 復元失敗時に元の途中結果を上書きしない。
        publishPartial([]);
        // 再構築した内容をまとめて公開する。
        fs.renameSync(currentPartial, partialOutput);
        // 以降の取得結果は公開中の途中CSVへ追記する。
        currentPartial = partialOutput;
    }
    // 横型は行の途中を公開せず、完成した連続範囲だけ途中CSVへ追加する。
    function publishPartial(ids) {
        // 縦型の部分公開は項目単位の追記で済んでいる。
        if (!partialOutput) return;
        // 再試行した縦型の行は、一定サイズのバッファで指定順に再公開する。
        if (mode === 'record-fields-preview') {
            // 変更がなければ大きなCSVのコピーを繰り返さない。
            if (!previewDirty) return;
            // 公開中のファイルを途中で切り詰めない。
            const staged = path.join(directory, 'partial-update.csv');
            // 更新後も同じ列定義を使う。
            fs.writeFileSync(staged, toCsv({ fields, records: [] }, mode), { mode: 0o600 });
            // 一項目ずつコピーし、全値をメモリへ復元しない。
            const destination = fs.openSync(staged, 'a');
            // コピー失敗時もハンドルを解放する。
            try {
                // Mapへの挿入順に依存せず項目位置で連結する。
                for (let index = 0; index < previewFiles.size; index++)
                    copyContents(previewFiles.get(index), destination);
            } finally {
                // 公開前に書き込みを終える。
                fs.closeSync(destination);
            }
            // 途中CSVを原子的に更新する。
            fs.renameSync(staged, currentPartial);
            // 同じ内容を再度コピーしない。
            previewDirty = false;
            // 横型のレコード追記は実行しない。
            return;
        }
        // 途中CSVを先頭から書き直さず、完成済み行だけ追記する。
        const destination = fs.openSync(currentPartial, 'a');
        // 読み書きエラー時も出力ハンドルを解放する。
        try {
            // APIの応答順によらず選択順を維持する。
            while (publishedRows < ids.length && positions.get(ids[publishedRows]) === fields.length) {
                // 一レコードの全項目が揃ってからファイルをコピーする。
                copyContents(files.get(ids[publishedRows]), destination);
                // 横型CSVのレコード境界を確定する。
                fs.writeFileSync(destination, '\r\n');
                // 同じレコードを二度公開しない。
                publishedRows++;
            }
        } finally {
            // 再開時には確定断片から途中CSVを再構築できる。
            fs.closeSync(destination);
        }
    }
    // レコード値を再構築せず、ファイルを小さなバッファで連結する。
    function finish(ids, output) {
        // 全レコードの全指定項目が揃ったことを確認する。
        if (files.size !== ids.length || ids.some((id) => positions.get(id) !== fields.length)) {
            // 部分成功を完成品として公開しない。
            throw new Error('CSVの項目またはレコードが揃っていません。');
        }
        // 出力先と同じファイルシステムに完成用の一時ファイルを置く。
        const staged = path.join(directory, 'complete.csv');
        // ヘッダーは指定項目順またはプレビューの固定列にする。
        fs.writeFileSync(staged, toCsv({ fields, records: [] }, mode), { flag: 'wx', mode: 0o600 });
        // ファイル全体をメモリへ読み込まず追記する。
        const destination = fs.openSync(staged, 'a');
        // 成功・失敗時ともファイル記述子を解放する。
        try {
            // 最新順で確定したIDの順番に連結する。
            for (const id of ids) {
                // 実値をメモリへまとめず断片をコピーする。
                if (mode === 'record-fields-preview') {
                    // 後から置換した行も、元の項目位置で連結する。
                    for (let index = 0; index < fields.length; index++)
                        copyContents(previewFiles.get(index), destination);
                } else copyContents(files.get(id), destination);
                // 横型の各レコード末尾だけに行区切りを追加する。
                if (mode === 'records') fs.writeFileSync(destination, '\r\n');
            }
        } finally {
            // 公開する前に書き込みを閉じる。
            fs.closeSync(destination);
        }
        // 既存ファイルを上書きせず、完成したファイルだけを原子的に公開する。
        fs.linkSync(staged, output);
    }
    // 保存と完成判定を実行入口に提供する。
    return { append, finish, publishPartial, activatePartial };
}

module.exports = { createCsvSpool };
