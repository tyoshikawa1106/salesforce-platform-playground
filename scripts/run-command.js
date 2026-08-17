const { spawnSync } = require('node:child_process');

// Windowsではnpmなどが提供する`.cmd`形式のCLIも実行できるようにcmd.exeを経由する。
function spawnCommand(command, args, options) {
    // `.exe`はWindowsでも直接起動し、それ以外の`.cmd`候補だけcmd.exeへ渡す。
    const needsWindowsShell = process.platform === 'win32' && !command.toLowerCase().endsWith('.exe');
    // ComSpecがない環境でもWindows標準のcmd.exeを使用する。
    const executable = needsWindowsShell ? (process.env.ComSpec ?? 'cmd.exe') : command;
    // 文字列連結したshell commandを作らず、CLI引数を配列のまま子プロセスへ渡す。
    const commandArgs = needsWindowsShell ? ['/d', '/s', '/c', command, ...args] : args;

    return spawnSync(executable, commandArgs, options);
}

/**
 * 外部CLIの出力をそのまま表示し、終了コードを呼び出し元へ返す。
 */
function runCommand(command, args, workingDirectory) {
    // Salesforce CLIの進捗やエラーを加工せず、実行者が直接確認できるようにする。
    const result = spawnCommand(command, args, {
        cwd: workingDirectory,
        stdio: 'inherit'
    });

    // CLI自体を起動できなかった場合だけ、このスクリプト側で原因を補足する。
    if (result.error) {
        console.error(`${command}を実行できませんでした: ${result.error.message}`);
        return 1;
    }

    // 後続処理を続けるか判断できるよう、CLIの終了コードを維持する。
    return result.status ?? 1;
}

/**
 * 外部CLIの出力を呼び出し元で解析できるよう、文字列として受け取る。
 */
function runCommandWithOutput(command, args, workingDirectory) {
    return spawnCommand(command, args, {
        cwd: workingDirectory,
        encoding: 'utf8'
    });
}

module.exports = { runCommand, runCommandWithOutput };
