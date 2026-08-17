// 実行方法: Scratch Org関連スクリプトから共通モジュールとして読み込む。
// 用途: 引数なしコマンドのhelp、未知の引数、終了コードを共通処理する。

function runNoArgumentCommand({ argv, usage, execute, stdout = process.stdout, stderr = process.stderr }) {
    // helpは組織操作を行わず、使用方法だけを表示する。
    if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
        stdout.write(`${usage.trimEnd()}\n`);
        return 0;
    }

    // 未知の引数がある場合は、実処理を開始する前に拒否する。
    if (argv.length > 0) {
        stderr.write(`エラー: 未対応の引数が指定されました: ${argv.join(', ')}\n`);
        stderr.write(`${usage.trimEnd()}\n`);
        return 1;
    }

    // 実処理が終了コードを返さない既存スクリプトは成功として扱う。
    const executeExitCode = execute();
    return executeExitCode ?? 0;
}

module.exports = {
    runNoArgumentCommand
};
