// 用途: 分割結果をIDごとの一時CSVへ退避し、指定順で完成ファイルを確定する。
const fs = require('node:fs');
const path = require('node:path');
const { csv, toCsv } = require('./collector');

// 1応答分を超える値を保持せず、列の順序と完全性を保存時にも確認する。
function createCsvSpool(directory, fields, mode) {
    // レコード値ではなく、保存済み列数だけを保持する。
    const positions = new Map();
    // IDは収集処理で検証済みだが、ファイル名には連番だけを使う。
    const files = new Map();
    // クエリの応答順と出力順を分離して保存する。
    function append(id, group, record, sources, latestId) {
        // 各レコードで次に来る項目の位置を求める。
        const offset = positions.get(id) || 0;
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
        // プレビューの固定列は既存のCSV変換と共通化する。
        const text =
            mode === 'record-fields-preview'
                ? toCsv({ fields: group, records: [record], sources, latestId }, mode).slice(
                      'FieldApiName,Label,Type,Value,Status,SourceRecordId\r\n'.length
                  )
                : `${offset ? ',' : ''}${group.map((field) => csv(record[field.name])).join(',')}`;
        // 初回は排他的に作成し、同じIDの後続項目だけを追記する。
        fs.writeFileSync(files.get(id), text, { flag: offset ? 'a' : 'wx', mode: 0o600 });
        // 保存成功後だけ進捗を確定する。
        positions.set(id, offset + group.length);
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
            // コピー用メモリをレコード数と独立した固定量に抑える。
            const buffer = Buffer.alloc(64 * 1024);
            // 最新順で確定したIDの順番に連結する。
            for (const id of ids) {
                // このレコードの断片だけを開く。
                const source = fs.openSync(files.get(id), 'r');
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
    return { append, finish };
}

module.exports = { createCsvSpool };
