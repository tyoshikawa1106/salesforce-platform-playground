// 実行方法: ApexテストとFlowテストの実行入口から読み込む。
// 用途: 組織テストを非同期で開始し、進捗監視後に最終結果を表示する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSf, runSfWithOutput } = require('../../internal/run-command');

// Salesforce CLIへ問い合わせる間隔を5秒に揃える。
const pollIntervalMs = 5_000;

// 組織テスト全体の処理が終了したと判断できるステータス。
const finishedStatuses = new Set(['Aborted', 'Completed', 'Failed', 'Passed', 'Skipped']);

// CLIの英語ステータスを利用者向けの日本語へ変換する。
const statusLabels = Object.freeze({
    Aborted: '中止',
    Completed: '完了',
    Failed: '失敗',
    Passed: '完了',
    Processing: '実行中',
    Queued: '待機中',
    Skipped: 'スキップ'
});

// Salesforce CLIの実行結果をJSONとして検証する。
function parseSfJson(result, operation) {
    if (result.error) {
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    let parsed;

    try {
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    if (result.status !== 0 || parsed.status !== 0) {
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        throw new Error(`${operation}に失敗しました${detail}`);
    }

    return parsed.result;
}

// 進捗をTTYでは同じ行へ、それ以外では行単位で表示する。
function createProgressReporter({ stdout = process.stdout, writeLine = console.log } = {}) {
    let previousLength = 0;

    function write(message, endOfLine) {
        if (!stdout.isTTY) {
            writeLine(message);
            return;
        }

        const padding = ' '.repeat(Math.max(0, previousLength - message.length));
        stdout.write(`\r${message}${padding}${endOfLine ? '\n' : ''}`);
        previousLength = endOfLine ? 0 : message.length;
    }

    return {
        finish(message) {
            write(message, true);
        },
        update(message) {
            write(message, false);
        }
    };
}

// Ctrl+Cでは監視だけを止められるよう、解除可能なハンドラーを登録する。
function registerInterruptHandler(handler, processRef = process) {
    processRef.once('SIGINT', handler);
    return () => processRef.removeListener('SIGINT', handler);
}

// テストランIDを使用した手動の結果取得コマンドを組み立てる。
function getResultCommand(testType, testRunId, targetOrg) {
    return `sf ${testType} get test --test-run-id ${testRunId} --code-coverage --result-format human --target-org ${targetOrg}`;
}

// テストランのクラス単位の進捗をTooling APIから取得する。
function getTestRunProgress({ repoRoot, runSfWithOutputCommand, targetOrg, testRunId }) {
    const query =
        `SELECT Status, ClassesCompleted, ClassesEnqueued ` +
        `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
    const result = parseSfJson(
        runSfWithOutputCommand(
            ['data', 'query', '--use-tooling-api', '--query', query, '--target-org', targetOrg, '--json'],
            repoRoot
        ),
        '組織テスト進捗の取得'
    );

    if (!result || !Array.isArray(result.records)) {
        throw new Error('組織テスト進捗の応答にrecordsがありません。');
    }

    if (result.records.length === 0) {
        return null;
    }

    if (result.records.length !== 1) {
        throw new Error('組織テスト進捗を一意に取得できませんでした。');
    }

    const [progress] = result.records;

    if (
        typeof progress.Status !== 'string' ||
        !Number.isInteger(progress.ClassesCompleted) ||
        !Number.isInteger(progress.ClassesEnqueued)
    ) {
        throw new Error('組織テスト進捗に必要な項目がありません。');
    }

    return progress;
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
    progressReporter = createProgressReporter(),
    writeLine = console.log,
    writeError = console.error
}) {
    if (testType !== 'apex' && testType !== 'flow') {
        throw new Error(`未対応の組織テスト種別です: ${testType}`);
    }

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
                progressReporter.finish('組織テストの進捗監視を終了しました。');
                writeError(`エラー: ${error.message}`);
                writeLine('組織上のテストは継続している可能性があります。');
                writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
                return 1;
            }

            if (progress === null) {
                progressReporter.update('進捗: キュー登録中');
            } else {
                const statusLabel = statusLabels[progress.Status] ?? progress.Status;
                const progressMessage =
                    `進捗: ${progress.ClassesCompleted} / ${progress.ClassesEnqueued}件完了` + `（${statusLabel}）`;

                if (finishedStatuses.has(progress.Status)) {
                    progressReporter.finish(progressMessage);
                    break;
                }

                progressReporter.update(progressMessage);
            }

            await Promise.race([waitForNextPoll(pollIntervalMs), interruptedPromise]);
        }

        if (interrupted) {
            progressReporter.finish('進捗監視を終了しました。組織上のテストは継続しています。');
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
    createProgressReporter,
    getResultCommand,
    getTestRunProgress,
    parseSfJson,
    registerInterruptHandler,
    runAndMonitorTests
};
