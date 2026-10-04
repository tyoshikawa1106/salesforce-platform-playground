// 実行方法: npm run sf:export:record-fields-preview -- --object Account --fields fields.txt
// 用途: 最新1件を基準に空欄を補完し、項目を指定順の縦型CSVに出力する。

const { main } = require('./internal/export-runner');

// import時の組織操作を避け、CLIとして起動した場合だけ実行する。
if (require.main === module) {
    // 確認入力がEOFで終了する場合も、未完了を成功扱いにしない。
    process.exitCode = 1;
    // 共通処理へ出力形式を固定して渡す。
    main(process.argv.slice(2), { mode: 'record-fields-preview' })
        .then((code) => {
            // 完了または明示中止の終了コードを反映する。
            process.exitCode = code;
        })
        .catch((error) => {
            // 生のCLI応答を含まない診断だけを表示する。
            console.error(error.message);
            // 失敗を呼び出し元へ返す。
            process.exitCode = 1;
        });
}
