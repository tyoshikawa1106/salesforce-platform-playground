// 実行方法: Scratch Org関連スクリプトから共通モジュールとして読み込む。
// 用途: Scratch Org alias、help、エラー、終了コードを共通処理する。

// --aliasが指定されていればその値を使い、未指定なら既定aliasを使用する。
function parseAlias(argv, defaultAlias, aliasRequired) {
    if (argv.length === 0) {
        if (aliasRequired) {
            throw new Error('Scratch Orgのaliasを--alias <alias>で指定してください。');
        }

        return defaultAlias;
    }

    if (argv[0] === '--alias') {
        // --aliasには空でない値を1つだけ指定する。
        if (argv.length < 2 || argv[1].length === 0 || argv[1].startsWith('-')) {
            throw new Error('--aliasには値が必要です。');
        }

        if (argv.length > 2) {
            throw new Error(`未対応の引数が指定されました: ${argv.slice(2).join(', ')}`);
        }

        return argv[1];
    }

    throw new Error(`未対応の引数が指定されました: ${argv.join(', ')}`);
}

function runAliasCommand({
    aliasRequired = false,
    argv,
    defaultAlias,
    execute,
    stderr = process.stderr,
    stdout = process.stdout,
    usage
}) {
    // helpは組織操作を行わず、使用方法だけを表示する。
    if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
        stdout.write(`${usage.trimEnd()}\n`);
        return 0;
    }

    try {
        // aliasを確定してから、組織を操作する実処理へ渡す。
        const alias = parseAlias(argv, defaultAlias, aliasRequired);
        const executeExitCode = execute(alias);
        return executeExitCode ?? 0;
    } catch (error) {
        // 利用者が修正すべき内容だけを表示し、生のスタックトレースを出さない。
        stderr.write(`エラー: ${error.message}\n`);
        stderr.write(`${usage.trimEnd()}\n`);
        return 1;
    }
}

module.exports = {
    parseAlias,
    runAliasCommand
};
