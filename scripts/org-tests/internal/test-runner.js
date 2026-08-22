// 実行方法: ApexテストとFlowテストの実行入口から読み込む。
// 用途: 組織テストを非同期で開始し、進捗監視後に最終結果を表示する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSf, runSfWithOutput } = require('../../internal/run-command');
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
    if (testType !== 'apex' && testType !== 'flow') {
        throw new Error(`未対応の組織テスト種別です: ${testType}`);
    }

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
    const testRunId = startResult?.testRunId;

    if (typeof testRunId !== 'string' || !/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(testRunId)) {
        throw new Error('テストランIDを取得できませんでした。');
    }

    writeLine(`テストランID: ${testRunId}`);

    let interrupted = false;
    let notifyInterrupted;
    const interruptedPromise = new Promise((resolve) => {
        notifyInterrupted = resolve;
    });
    const unregisterInterrupt = registerInterrupt(() => {
        interrupted = true;
        notifyInterrupted();
    });

    try {
        while (!interrupted) {
            let progress;

            try {
                progress = getTestRunProgress({ repoRoot, runSfWithOutputCommand, targetOrg, testRunId });
            } catch (error) {
                reporter.finish('組織テストの進捗監視を終了しました。');
                writeError(`エラー: ${error.message}`);
                writeLine('組織上のテストは継続している可能性があります。');
                writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
                return 1;
            }

            const progressDescription = describeTestRunProgress(progress);

            if (progressDescription.finished) {
                reporter.finish(progressDescription.message);
                break;
            }

            reporter.update(progressDescription.message);

            await Promise.race([waitForNextPoll(pollIntervalMs), interruptedPromise]);
        }

        if (interrupted) {
            reporter.finish('進捗監視を終了しました。組織上のテストは継続しています。');
            writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
            return 130;
        }
    } finally {
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
