// 実行方法: ApexテストとFlowテストの実行入口から読み込む。
// 用途: 組織テストを非同期で開始し、進捗監視後に最終結果を表示する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSf, runSfWithOutput } = require('../../common/run-command');
const { createProgressReporter, describeTestRunProgress, getTestRunProgress, parseSfJson } = require('./test-progress');

// Salesforce CLIへ問い合わせる間隔を5秒に揃える。
const pollIntervalMs = 5_000;

// Ctrl+Cでは監視だけを止められるよう、解除可能なハンドラーを登録する。
function registerInterruptHandler(handler, processRef = process) {
    // 同じ実行で最初に受信したSIGINTだけを監視終了へ利用する。
    processRef.once('SIGINT', handler);
    // 完了後に登録したhandlerだけを解除できる関数を返す。
    return () => processRef.removeListener('SIGINT', handler);
}

// テストランIDを使用した手動の結果取得コマンドを組み立てる。
function getResultCommand(testType, testRunId, targetOrg) {
    // 結果、coverage、対象組織を明示した手動確認コマンドを返す。
    return `sf ${testType} get test --test-run-id ${testRunId} --code-coverage --result-format human --target-org ${targetOrg}`;
}

// ApexまたはFlowのローカルテストを開始し、完了まで進捗を監視する。
async function runAndMonitorTests({
    testType,
    targetOrg,
    repoRoot,
    runSfCommand = runSf,
    runSfWithOutputCommand = runSfWithOutput,
    waitForNextPoll = wait,
    registerInterrupt = registerInterruptHandler,
    progressReporter,
    writeLine = console.log,
    writeError = console.error
}) {
    // Salesforce CLIで対応する2種類以外をコマンドへ渡さない。
    if (testType !== 'apex' && testType !== 'flow') {
        // 未対応値を含むエラーで呼び出し側の設定ミスを明示する。
        throw new Error(`未対応の組織テスト種別です: ${testType}`);
    }

    // 呼び出し元の表示先がなければ標準の進捗表示を作成する。
    const reporter = progressReporter ?? createProgressReporter({ writeLine });

    // JSON応答からテストランIDを安全に取得できる形で非同期実行を開始する。
    const startResult = parseSfJson(
        runSfWithOutputCommand(
            [
                testType,
                'run',
                'test',
                '--test-level',
                'RunLocalTests',
                '--code-coverage',
                '--target-org',
                targetOrg,
                '--json'
            ],
            repoRoot
        ),
        `${testType === 'apex' ? 'Apex' : 'Flow'}テストの開始`
    );
    // 応答から取得したIDを、後続のSOQLとCLI引数に使用する前に検証する。
    const testRunId = startResult?.testRunId;

    // Salesforce ID形式の15桁または18桁だけを後続クエリへ使用する。
    if (typeof testRunId !== 'string' || !/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(testRunId)) {
        // 不正なIDでTooling APIを照会せず停止する。
        throw new Error('テストランIDを取得できませんでした。');
    }

    // 手動確認にも使えるテストランIDを開始直後に表示する。
    writeLine(`テストランID: ${testRunId}`);

    // Ctrl+C通知をpoll待機と共有するため、flagとPromiseの両方を用意する。
    let interrupted = false;
    // Promiseを解決する関数をSIGINT handlerから参照できるよう保持する。
    let notifyInterrupted;
    // poll待機と競合させる中断通知Promiseを作成する。
    const interruptedPromise = new Promise((resolve) => {
        // SIGINT受信時に呼び出すresolveを外側へ保存する。
        notifyInterrupted = resolve;
    });
    // SIGINT受信時は組織上のテストを停止せず、ローカル監視だけを終了させる。
    const unregisterInterrupt = registerInterrupt(() => {
        // poll loopが次の反復へ進まない中断状態へ更新する。
        interrupted = true;
        // 待機中のPromise.raceを即時に完了させる。
        notifyInterrupted();
    });

    // 正常終了や例外でSIGINT handlerを確実に解除できる範囲を開始する。
    try {
        // 中断されるまで進捗を一定間隔で取得する。
        while (!interrupted) {
            // 1回分のTooling API進捗を保持する。
            let progress;

            // 進捗取得失敗を組織テスト自体の失敗と区別する。
            try {
                // 現在のテストランに対応する最新進捗を取得する。
                progress = getTestRunProgress({ repoRoot, runSfWithOutputCommand, targetOrg, testRunId });
            } catch (error) {
                // 監視不能でも組織上のテスト状態を断定せず、手動確認方法を残す。
                reporter.finish('組織テストの進捗監視を終了しました。');
                // 進捗取得に失敗した原因をエラー出力へ表示する。
                writeError(`エラー: ${error.message}`);
                // 組織上の処理が終了したとは限らないことを表示する。
                writeLine('組織上のテストは継続している可能性があります。');
                // 後から結果を取得できる完全なコマンドを表示する。
                writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
                // ローカル監視失敗として非0終了を返す。
                return 1;
            }

            // API応答を終了判定と利用者向けメッセージへ変換する。
            const progressDescription = describeTestRunProgress(progress);

            // 完了状態では表示行を確定し、poll loopを抜ける。
            if (progressDescription.finished) {
                // 最終進捗を改行付きで確定する。
                reporter.finish(progressDescription.message);
                // 追加のpollを行わず最終結果取得へ進む。
                break;
            }

            // 未完了状態を表示し、次のpoll時刻またはCtrl+Cを待つ。
            reporter.update(progressDescription.message);

            // 設定間隔またはSIGINTの早い方まで非同期に待機する。
            await Promise.race([waitForNextPoll(pollIntervalMs), interruptedPromise]);
        }

        // Ctrl+C時は組織上の処理を残し、shell慣例の終了コード130を返す。
        if (interrupted) {
            // ローカル監視だけを終了したことを最終表示として確定する。
            reporter.finish('進捗監視を終了しました。組織上のテストは継続しています。');
            // 利用者が後から確認できる結果取得コマンドを表示する。
            writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
            // Ctrl+Cによる中断をshell慣例の終了コードで返す。
            return 130;
        }
    } finally {
        // 正常終了や例外後に、この実行用のSIGINT listenerを残さない。
        unregisterInterrupt();
    }

    // 完了したテストランの詳細結果とカバレッジを自動で表示する。
    return runSfCommand(
        [
            testType,
            'get',
            'test',
            '--test-run-id',
            testRunId,
            '--code-coverage',
            '--result-format',
            'human',
            '--target-org',
            targetOrg
        ],
        repoRoot
    );
}

module.exports = {
    getResultCommand,
    registerInterruptHandler,
    runAndMonitorTests
};
