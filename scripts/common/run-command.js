// 実行方法: Salesforce CLIとNode.js子スクリプトの実行元から読み込む。
// 用途: macOSとWindowsで外部処理を実行し、終了コードまたは出力を返す。

const { spawnSync } = require('node:child_process');

// cmd.exeが別のコマンドとして解釈する文字をWindows向け引数では許可しない。
const unsafeWindowsArgument = /[\r\n&|<>^%!"()]/;

// Salesforce CLIを起動するコマンドと引数をOSに合わせて組み立てる。
function buildSfCommand(args, platform = process.platform) {
    // macOSなどではshellを介さずsf実行ファイルへ引数配列を直接渡す。
    if (platform !== 'win32') {
        return { command: 'sf', args };
    }

    // Windowsではsf.cmdへ安全な引数だけを渡す。
    const unsafeArgument = args.find((arg) => typeof arg !== 'string' || unsafeWindowsArgument.test(arg));

    if (unsafeArgument !== undefined) {
        throw new Error('Windowsで使用できない文字が引数に含まれています。');
    }

    return {
        command: 'cmd.exe',
        args: ['/d', '/c', 'sf', ...args]
    };
}

// 子プロセスを開始できなかった場合の表示と終了コードを共通化する。
function getExitCode(result, command) {
    // spawnエラーは子プロセスの終了コードがないため共通の失敗コードへ変換する。
    if (result.error) {
        console.error(`エラー: ${command}を実行できませんでした: ${result.error.message}`);
        return 1;
    }

    // signal終了などstatusがない場合も成功として扱わない。
    return result.status ?? 1;
}

// Salesforce CLIの出力をそのまま表示し、終了コードを返す。
function runSf(args, workingDirectory, spawnCommand = spawnSync) {
    try {
        // OS別の安全な起動方法へ変換してからSalesforce CLIを実行する。
        const sfCommand = buildSfCommand(args);
        // 対話中の表示を保つため、標準入出力を親プロセスへ接続する。
        const result = spawnCommand(sfCommand.command, sfCommand.args, {
            cwd: workingDirectory,
            stdio: 'inherit'
        });

        // 呼び出し元が後続処理を止められるよう終了コードだけを返す。
        return getExitCode(result, 'sf');
    } catch (error) {
        // Windows引数検証など起動前の失敗も利用者向けメッセージへ揃える。
        console.error(`エラー: sfを実行できませんでした: ${error.message}`);
        return 1;
    }
}

// Salesforce CLIの出力を呼び出し元で解析できる文字列として返す。
function runSfWithOutput(args, workingDirectory, spawnCommand = spawnSync) {
    try {
        // JSON応答を解析する呼び出し元向けに、出力を文字列として保持する。
        const sfCommand = buildSfCommand(args);
        return spawnCommand(sfCommand.command, sfCommand.args, {
            cwd: workingDirectory,
            encoding: 'utf8'
        });
    } catch (error) {
        // spawn結果と同じ形を返し、呼び出し元のエラー処理を一本化する。
        return { error, status: null, stdout: '', stderr: '' };
    }
}

// 現在使用中のNode.jsで子スクリプトを直接実行する。
function runNodeScript(scriptPath, args, workingDirectory) {
    // npmで選択されたNode.jsと同じ実行ファイルを子スクリプトにも使用する。
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: workingDirectory,
        stdio: 'inherit'
    });

    // Salesforce CLIと同じ終了コード規約で親スクリプトへ結果を返す。
    return getExitCode(result, 'Node.jsスクリプト');
}

module.exports = { buildSfCommand, runNodeScript, runSf, runSfWithOutput };
