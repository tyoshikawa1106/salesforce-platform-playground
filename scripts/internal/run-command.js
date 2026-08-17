// 実行方法: Salesforce CLIとNode.js子スクリプトの実行元から読み込む。
// 用途: macOSとWindowsで外部処理を実行し、終了コードまたは出力を返す。

const { spawnSync } = require('node:child_process');

// cmd.exeが別のコマンドとして解釈する文字をWindows向け引数では許可しない。
const unsafeWindowsArgument = /[\r\n&|<>^%!"()]/;

// Salesforce CLIを起動するコマンドと引数をOSに合わせて組み立てる。
function buildSfCommand(args, platform = process.platform) {
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
    if (result.error) {
        console.error(`エラー: ${command}を実行できませんでした: ${result.error.message}`);
        return 1;
    }

    return result.status ?? 1;
}

// Salesforce CLIの出力をそのまま表示し、終了コードを返す。
function runSf(args, workingDirectory) {
    try {
        const sfCommand = buildSfCommand(args);
        const result = spawnSync(sfCommand.command, sfCommand.args, {
            cwd: workingDirectory,
            stdio: 'inherit'
        });

        return getExitCode(result, 'sf');
    } catch (error) {
        console.error(`エラー: sfを実行できませんでした: ${error.message}`);
        return 1;
    }
}

// Salesforce CLIの出力を呼び出し元で解析できる文字列として返す。
function runSfWithOutput(args, workingDirectory) {
    try {
        const sfCommand = buildSfCommand(args);
        return spawnSync(sfCommand.command, sfCommand.args, {
            cwd: workingDirectory,
            encoding: 'utf8'
        });
    } catch (error) {
        return { error, status: null, stdout: '', stderr: '' };
    }
}

// 現在使用中のNode.jsで子スクリプトを直接実行する。
function runNodeScript(scriptPath, args, workingDirectory) {
    const result = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: workingDirectory,
        stdio: 'inherit'
    });

    return getExitCode(result, 'Node.jsスクリプト');
}

module.exports = { buildSfCommand, runNodeScript, runSf, runSfWithOutput };
