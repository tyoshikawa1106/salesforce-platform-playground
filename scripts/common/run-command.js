// 実行方法: Salesforce CLIとNode.js子スクリプトの実行元から読み込む。
// 用途: macOSとWindowsで外部処理を実行し、終了コードまたは出力を返す。

const { execFile, spawnSync } = require('node:child_process');

// cmd.exeが別のコマンドとして解釈する文字をWindows向け引数では許可しない。
const unsafeWindowsArgument = /[\r\n&|<>^%!"()]/;

// Salesforce CLIを起動するコマンドと引数をOSに合わせて組み立てる。
function buildSfCommand(args, platform = process.platform) {
    // macOSなどではshellを介さずsf実行ファイルへ引数配列を直接渡す。
    if (platform !== 'win32') {
        // 非Windowsではshell解釈を介さない起動方法を維持する。
        return { command: 'sf', args };
    }

    // Windowsではsf.cmdへ安全な引数だけを渡す。
    const unsafeArgument = args.find((arg) => typeof arg !== 'string' || unsafeWindowsArgument.test(arg));

    // 危険な引数が1件でもあればcmd.exeを起動しない。
    if (unsafeArgument !== undefined) {
        // shell解釈による別コマンド実行を防ぐため安全側で停止する。
        throw new Error('Windowsで使用できない文字が引数に含まれています。');
    }

    // AutoRun設定を無効化したcmd.exeから、安全確認済みの引数だけをsfへ渡す。
    return {
        command: 'cmd.exe',
        args: ['/d', '/c', 'sf', ...args]
    };
}

// 子プロセスを開始できなかった場合の表示と終了コードを共通化する。
function getExitCode(result, command) {
    // spawnエラーは子プロセスの終了コードがないため共通の失敗コードへ変換する。
    if (result.error) {
        // 実行できなかったコマンド種別とOSエラーを利用者へ表示する。
        console.error(`エラー: ${command}を実行できませんでした: ${result.error.message}`);
        // 起動失敗をshell慣例の非0終了として返す。
        return 1;
    }

    // signal終了などstatusがない場合も成功として扱わない。
    return result.status ?? 1;
}

// Salesforce CLIの出力をそのまま表示し、終了コードを返す。
function runSf(args, workingDirectory, spawnCommand = spawnSync, timeout) {
    // OS別コマンド組み立ての例外も同じ終了コード規約へ揃える。
    try {
        // OS別の安全な起動方法へ変換してからSalesforce CLIを実行する。
        const sfCommand = buildSfCommand(args);
        // 対話中の表示を保つため、標準入出力を親プロセスへ接続する。
        const options = {
            cwd: workingDirectory,
            stdio: 'inherit'
        };

        // 長時間応答がない呼び出しだけ、指定時間で子プロセスを終了できるようにする。
        if (timeout !== undefined) {
            options.timeout = timeout;
        }

        const result = spawnCommand(sfCommand.command, sfCommand.args, options);

        // 呼び出し元が後続処理を止められるよう終了コードだけを返す。
        return getExitCode(result, 'sf');
    } catch (error) {
        // Windows引数検証など起動前の失敗も利用者向けメッセージへ揃える。
        console.error(`エラー: sfを実行できませんでした: ${error.message}`);
        // 起動前の失敗を呼び出し元へ非0で返す。
        return 1;
    }
}

// Salesforce CLIの出力を呼び出し元で解析できる文字列として返す。
function runSfWithOutput(args, workingDirectory, spawnCommand = spawnSync, maxBuffer, timeout) {
    // OS別コマンド組み立てに失敗してもspawn結果と同じ形で返す。
    try {
        // JSON応答を解析する呼び出し元向けに、出力を文字列として保持する。
        const sfCommand = buildSfCommand(args);
        // JSON解析や診断で両方の出力を参照できる起動設定を使用する。
        const options = {
            cwd: workingDirectory,
            encoding: 'utf8'
        };

        // 大きいJSON応答を扱う呼び出しだけ、明示された出力上限を適用する。
        if (maxBuffer !== undefined) {
            // spawnSyncが無制限に出力を保持しないよう、呼び出し側の上限を渡す。
            options.maxBuffer = maxBuffer;
        }

        // JSON応答待ちが停止した場合に備え、呼び出し側が指定した実行上限を適用する。
        if (timeout !== undefined) {
            options.timeout = timeout;
        }

        // 呼び出し元が解析できる標準出力と標準エラーを返す。
        return spawnCommand(sfCommand.command, sfCommand.args, options);
    } catch (error) {
        // spawn結果と同じ形を返し、呼び出し元のエラー処理を一本化する。
        return { error, status: null, stdout: '', stderr: '' };
    }
}

// Salesforce CLIを非同期で実行し、監視中のCtrl+Cで中断できる出力を返す。
function runSfWithOutputAsync(args, workingDirectory, execCommand = execFile, maxBuffer, timeout, signal) {
    // callback形式のexecFile結果を呼び出し元がawaitできる形へ変換する。
    return new Promise((resolve) => {
        // OS別コマンド組み立てに失敗しても同期版と同じ結果形式で返す。
        try {
            // shellを介さないOS別のSalesforce CLIコマンドを組み立てる。
            const sfCommand = buildSfCommand(args);
            // JSON応答を文字列で取得する基本設定を使用する。
            const options = {
                cwd: workingDirectory,
                encoding: 'utf8'
            };

            // 呼び出し元が指定した場合だけ出力上限を変更する。
            if (maxBuffer !== undefined) {
                // 非同期CLIが保持する出力量を指定値に制限する。
                options.maxBuffer = maxBuffer;
            }

            // 呼び出し元が指定した場合だけ1回のCLI応答待ちに上限を設ける。
            if (timeout !== undefined) {
                // 組織上の処理全体ではなく子プロセスの応答待ちだけを制限する。
                options.timeout = timeout;
            }

            // Ctrl+Cなどのローカル中断を実行中の子プロセスへ伝える。
            if (signal !== undefined) {
                // 呼び出し元が管理するAbortSignalをexecFileへ渡す。
                options.signal = signal;
            }

            // 完了時の出力とエラーを同期版と同じ結果形式へ変換する。
            execCommand(sfCommand.command, sfCommand.args, options, (error, stdout = '', stderr = '') => {
                // CLIが返した非0終了はJSONを解析できるよう、終了コードとして保持する。
                if (error && typeof error.code === 'number') {
                    // 標準出力を残し、呼び出し元がCLIのJSONエラーを判定できる形で返す。
                    resolve({ signal: error.signal ?? null, status: error.code, stderr, stdout });
                    // 同じエラーを起動失敗として重複処理しない。
                    return;
                }

                // 起動失敗、timeout、AbortSignalによる中断は原因を呼び出し元へ返す。
                if (error) {
                    // 終了状態を確定できないエラーはerrorオブジェクト付きで返す。
                    resolve({ error, signal: error.signal ?? null, status: null, stderr, stdout });
                    // 成功結果へ後続しない。
                    return;
                }

                // 子プロセスの正常終了と出力を返す。
                resolve({ signal: null, status: 0, stderr, stdout });
            });
        } catch (error) {
            // コマンド組み立て中の例外も非同期呼び出しの失敗結果へ揃える。
            resolve({ error, signal: null, status: null, stdout: '', stderr: '' });
        }
    });
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

module.exports = { buildSfCommand, runNodeScript, runSf, runSfWithOutput, runSfWithOutputAsync };
