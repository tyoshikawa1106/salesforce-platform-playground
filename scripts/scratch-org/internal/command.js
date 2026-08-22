// 実行方法: Scratch Org関連スクリプトから共通モジュールとして読み込む。
// 用途: Scratch Org alias、help、エラー、終了コードを共通処理する。

// --aliasが指定されていればその値を使い、未指定なら既定aliasを使用する。
function parseAlias(argv, defaultAlias, aliasRequired) {
    // 引数なしの場合だけ、必須指定または既定値の規則を適用する。
    if (argv.length === 0) {
        // 削除などalias必須操作では既定値へ暗黙にフォールバックしない。
        if (aliasRequired) {
            // 明示指定が必要なことを利用者へ伝える。
            throw new Error('Scratch Orgのaliasを--alias <alias>で指定してください。');
        }

        // 任意指定のコマンドでは設定ファイルのaliasを使用する。
        return defaultAlias;
    }

    // 先頭引数が--aliasの場合だけ値の検証へ進む。
    if (argv[0] === '--alias') {
        // --aliasには空でない値を1つだけ指定する。
        if (argv.length < 2 || argv[1].length === 0 || argv[1].startsWith('-')) {
            // 空値や次のオプション名をaliasとして受け付けない。
            throw new Error('--aliasには値が必要です。');
        }

        // alias以外の余分な位置引数やオプションを許可しない。
        if (argv.length > 2) {
            // 余分な引数をメッセージへ含めて修正対象を明示する。
            throw new Error(`未対応の引数が指定されました: ${argv.slice(2).join(', ')}`);
        }

        // 検証済みのalias値だけを組織操作へ返す。
        return argv[1];
    }

    // --alias以外の指定を実処理へ渡さず拒否する。
    throw new Error(`未対応の引数が指定されました: ${argv.join(', ')}`);
}

// aliasを取るScratch Orgコマンドのhelp、検証、例外表示を共通化する。
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
        // テスト時も出力先を差し替えられる経路で使用方法を案内する。
        stdout.write(`${usage.trimEnd()}\n`);
        // 組織操作を行わない正常終了として0を返す。
        return 0;
    }

    // 引数または実処理の例外を共通の利用者向け表示へ変換する。
    try {
        // aliasを確定してから、組織を操作する実処理へ渡す。
        const alias = parseAlias(argv, defaultAlias, aliasRequired);
        // 検証済みaliasだけを個別コマンドの実処理へ渡す。
        const executeExitCode = execute(alias);
        // 実処理が終了コードを返さない場合は成功としてCLI規約へ揃える。
        return executeExitCode ?? 0;
    } catch (error) {
        // 利用者が修正すべき内容だけを表示し、生のスタックトレースを出さない。
        stderr.write(`エラー: ${error.message}\n`);
        // エラー後に正しい実行方法も表示する。
        stderr.write(`${usage.trimEnd()}\n`);
        // 引数または実処理の失敗として1を返す。
        return 1;
    }
}

module.exports = {
    parseAlias,
    runAliasCommand
};
