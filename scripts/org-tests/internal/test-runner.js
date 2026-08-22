// 実行方法: ApexテストとFlowテストの実行入口から読み込む。
// 用途: 組織テストを非同期で開始し、進捗監視後に最終結果を表示する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSf, runSfWithOutput } = require('../../common/run-command');
const { createProgressReporter, describeTestRunProgress, getTestRunProgress, parseSfJson } = require('./test-progress');

// Salesforce CLIへ問い合わせる間隔を5秒に揃える。
const pollIntervalMs = 5_000;

// Ctrl+Cでは監視だけを止められるよう、解除可能なハンドラーを登録する。
function registerInterruptHandler(handler, processRef = process) {
    processRef.once('SIGINT', handler);
    return () => processRef.removeListener('SIGINT', handler);
}

// テストランIDを使用した手動の結果取得コマンドを組み立てる。
function getResultCommand(testType, testRunId, targetOrg) {
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

    if (typeof testRunId !== 'string' || !/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(testRunId)) {
        throw new Error('テストランIDを取得できませんでした。');
    }

    // 手動確認にも使えるテストランIDを開始直後に表示する。
    writeLine(`テストランID: ${testRunId}`);

    // Ctrl+C通知をpoll待機と共有するため、flagとPromiseの両方を用意する。
    let interrupted = false;
    let notifyInterrupted;
    const interruptedPromise = new Promise((resolve) => {
        notifyInterrupted = resolve;
    });
    // SIGINT受信時は組織上のテストを停止せず、ローカル監視だけを終了させる。
    const unregisterInterrupt = registerInterrupt(() => {
        interrupted = true;
        notifyInterrupted();
    });

    try {
        while (!interrupted) {
            // 1回分のTooling API進捗を保持する。
            let progress;

            try {
                progress = getTestRunProgress({ repoRoot, runSfWithOutputCommand, targetOrg, testRunId });
            } catch (error) {
                // 監視不能でも組織上のテスト状態を断定せず、手動確認方法を残す。
                reporter.finish('組織テストの進捗監視を終了しました。');
                writeError(`エラー: ${error.message}`);
                writeLine('組織上のテストは継続している可能性があります。');
                writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
                return 1;
            }

            // API応答を終了判定と利用者向けメッセージへ変換する。
            const progressDescription = describeTestRunProgress(progress);

            // 完了状態では表示行を確定し、poll loopを抜ける。
            if (progressDescription.finished) {
                reporter.finish(progressDescription.message);
                break;
            }

            // 未完了状態を表示し、次のpoll時刻またはCtrl+Cを待つ。
            reporter.update(progressDescription.message);

            await Promise.race([waitForNextPoll(pollIntervalMs), interruptedPromise]);
        }

        // Ctrl+C時は組織上の処理を残し、shell慣例の終了コード130を返す。
        if (interrupted) {
            reporter.finish('進捗監視を終了しました。組織上のテストは継続しています。');
            writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
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
