// 実行方法: destructive.jsとテストスクリプトから読み込む。
// 用途: destructive deployを非同期で開始し、完了監視後に削除対象とApexテスト結果を検証する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSf, runSfWithOutput } = require('../../../common/run-command');
const { createProgressReporter } = require('../../../org-tests/internal/test-progress');

// Salesforce CLIへ問い合わせる間隔を5秒に揃える。
const pollIntervalMs = 5_000;
// 大きいdeploy結果でもJSONが途中で切れないよう、明示的な上限を設定する。
const maxJsonBuffer = 50 * 1024 * 1024;
// Metadata API deployで返り得る状態だけを監視対象として許可する。
const deployStatuses = new Set([
    'Pending',
    'InProgress',
    'Succeeded',
    'SucceededPartial',
    'Failed',
    'Canceling',
    'Canceled',
    'Finalizing',
    'FinalizingFailed',
    'Queued'
]);

// Ctrl+Cでは監視だけを止められるよう、解除可能なハンドラーを登録する。
function registerInterruptHandler(handler, processRef = process) {
    processRef.once('SIGINT', handler);
    return () => processRef.removeListener('SIGINT', handler);
}

// CLIのJSON応答を解析し、外側のstatusとdeploy結果を分けて返す。
function parseSfJson(result, operation, { allowNonZero = false } = {}) {
    if (result.error) {
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    let parsed;

    try {
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    if (!allowNonZero && (result.status !== 0 || parsed.status !== 0)) {
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        throw new Error(`${operation}に失敗しました${detail}`);
    }

    if (!parsed.result || typeof parsed.result !== 'object' || Array.isArray(parsed.result)) {
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        throw new Error(`${operation}の応答にresultがありません${detail}`);
    }

    return parsed.result;
}

// deploy job IDを後続のCLI引数へ渡す前に検証する。
function validateDeployId(deployId) {
    if (typeof deployId !== 'string' || !/^0Af[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(deployId)) {
        throw new Error('deploy job IDを取得できませんでした。');
    }

    return deployId;
}

// 監視応答に終了判定と表示に必要な値が揃っていることを確認する。
function validateProgressResult(result, deployId) {
    if (result.id !== deployId) {
        throw new Error('deploy監視結果のjob IDが開始したjobと一致しません。');
    }

    if (typeof result.done !== 'boolean' || typeof result.status !== 'string' || !deployStatuses.has(result.status)) {
        throw new Error('deploy監視結果に有効な完了状態がありません。');
    }

    for (const field of [
        'numberComponentsDeployed',
        'numberComponentsTotal',
        'numberTestsCompleted',
        'numberTestsTotal'
    ]) {
        if (!Number.isInteger(result[field]) || result[field] < 0) {
            throw new Error(`deploy監視結果の${field}が不正です。`);
        }
    }

    return result;
}

// deployのmetadata件数とApexテスト件数を1行の進捗へ変換する。
function describeDeployProgress(result) {
    return (
        `進捗: metadata ${result.numberComponentsDeployed} / ${result.numberComponentsTotal}件、` +
        `Apex ${result.numberTestsCompleted} / ${result.numberTestsTotal}件（${result.status}）`
    );
}

// 単一値または配列で返るMetadata API詳細を同じ反復形式へ揃える。
function toArray(value) {
    if (value === undefined || value === null) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

// JSON上の数値文字列を非負整数として厳密に読み取る。
function parseIntegerString(value, field) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw new Error(`deploy結果の${field}が不正です。`);
    }

    return Number(value);
}

// 削除結果の照合用にmetadata typeとfullNameの組を一意なkeyへ変換する。
function getComponentKey(type, fullName) {
    return `${type}\u0000${fullName}`;
}

// 成功応答が削除とApexテストの安全契約をすべて満たすことを確認する。
function validateSuccessfulDeployResult({ result, deployId, dryRun, expectedComponents }) {
    validateProgressResult(result, deployId);

    if (result.done !== true || result.status !== 'Succeeded' || result.success !== true) {
        throw new Error(`deployが成功状態ではありません: ${result.status}`);
    }

    if (result.checkOnly !== dryRun) {
        throw new Error('deploy結果のdry-run種別が開始時の指定と一致しません。');
    }

    if (result.rollbackOnError !== true || result.ignoreWarnings !== false) {
        throw new Error('deploy結果で全体ロールバックを保証できません。');
    }

    if (result.runTestsEnabled !== true) {
        throw new Error('deploy結果でApexテスト実行を確認できません。');
    }

    for (const field of ['numberComponentErrors', 'numberTestErrors']) {
        if (!Number.isInteger(result[field]) || result[field] !== 0) {
            throw new Error(`deploy結果の${field}が0ではありません。`);
        }
    }

    if (result.numberComponentsTotal <= 0 || result.numberComponentsDeployed !== result.numberComponentsTotal) {
        throw new Error('deploy結果でmetadata componentの全件完了を確認できません。');
    }

    if (
        !Number.isInteger(result.numberTestsTotal) ||
        result.numberTestsTotal <= 0 ||
        !Number.isInteger(result.numberTestsCompleted) ||
        result.numberTestsCompleted !== result.numberTestsTotal
    ) {
        throw new Error('deploy結果でApexテストの全件完了を確認できません。');
    }

    const runTestResult = result.details?.runTestResult;

    if (!runTestResult || typeof runTestResult !== 'object') {
        throw new Error('deploy結果にApexテスト詳細がありません。');
    }

    const testsRun = parseIntegerString(runTestResult.numTestsRun, 'numTestsRun');
    const testFailures = parseIntegerString(runTestResult.numFailures, 'numFailures');

    if (testsRun !== result.numberTestsCompleted || testFailures !== 0) {
        throw new Error('deploy結果のApexテスト集計が完了件数または失敗件数と一致しません。');
    }

    const deletedComponents = new Set();

    for (const file of toArray(result.files)) {
        if (file?.state === 'Deleted' && typeof file.type === 'string' && typeof file.fullName === 'string') {
            deletedComponents.add(getComponentKey(file.type, file.fullName));
        }
    }

    for (const component of toArray(result.details?.componentSuccesses)) {
        if (
            (component?.deleted === true || component?.deleted === 'true') &&
            typeof component.componentType === 'string' &&
            typeof component.fullName === 'string'
        ) {
            deletedComponents.add(getComponentKey(component.componentType, component.fullName));
        }
    }

    for (const component of expectedComponents) {
        if (!deletedComponents.has(getComponentKey(component.type, component.fullName))) {
            throw new Error(`削除結果を確認できません: ${component.type} ${component.fullName}`);
        }
    }

    return {
        deletedCount: expectedComponents.length,
        testsCompleted: result.numberTestsCompleted,
        testsTotal: result.numberTestsTotal
    };
}

// deploy job IDを使用した手動の結果取得コマンドを組み立てる。
function getReportCommand(deployId, targetOrg) {
    return `sf project deploy report --job-id ${deployId} --target-org ${targetOrg}`;
}

// destructive deployを非同期で開始し、完了まで監視して成功内容を検証する。
async function runAndMonitorDeploy({
    deployArgs,
    dryRun,
    expectedComponents,
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
    if (!Array.isArray(expectedComponents) || expectedComponents.length === 0) {
        throw new Error('構造検証する削除対象がありません。');
    }

    const reporter = progressReporter ?? createProgressReporter({ writeLine });
    const startArgs = [...deployArgs, ...(dryRun ? ['--dry-run'] : []), '--async', '--json'];
    const startResult = parseSfJson(
        runSfWithOutputCommand(startArgs, repoRoot, undefined, maxJsonBuffer),
        `${dryRun ? 'dry-run' : 'destructive deploy'}の開始`
    );
    const deployId = validateDeployId(startResult.id);
    writeLine(`deploy job ID: ${deployId}`);

    let interrupted = false;
    let notifyInterrupted;
    const interruptedPromise = new Promise((resolve) => {
        notifyInterrupted = resolve;
    });
    const unregisterInterrupt = registerInterrupt(() => {
        interrupted = true;
        notifyInterrupted();
    });
    let finalResult;

    try {
        while (!interrupted) {
            try {
                finalResult = validateProgressResult(
                    parseSfJson(
                        runSfWithOutputCommand(
                            ['project', 'deploy', 'report', '--job-id', deployId, '--target-org', targetOrg, '--json'],
                            repoRoot,
                            undefined,
                            maxJsonBuffer
                        ),
                        'deploy進捗の取得',
                        { allowNonZero: true }
                    ),
                    deployId
                );
            } catch (error) {
                reporter.finish('destructive deployの進捗監視を終了しました。');
                writeError(`エラー: ${error.message}`);
                writeLine('組織上のdeployは継続している可能性があります。');
                writeLine(`結果確認: ${getReportCommand(deployId, targetOrg)}`);
                return 1;
            }

            const message = describeDeployProgress(finalResult);

            if (finalResult.done) {
                reporter.finish(message);
                break;
            }

            reporter.update(message);
            await Promise.race([waitForNextPoll(pollIntervalMs), interruptedPromise]);
        }

        if (interrupted) {
            reporter.finish('進捗監視を終了しました。組織上のdeployは継続しています。');
            writeLine(`結果確認: ${getReportCommand(deployId, targetOrg)}`);
            return 130;
        }
    } finally {
        unregisterInterrupt();
    }

    const reportStatus = runSfCommand(
        ['project', 'deploy', 'report', '--job-id', deployId, '--target-org', targetOrg],
        repoRoot
    );

    if (reportStatus !== 0) {
        return reportStatus;
    }

    try {
        const summary = validateSuccessfulDeployResult({ result: finalResult, deployId, dryRun, expectedComponents });
        writeLine(
            `検証結果: 削除対象 ${summary.deletedCount}件、` +
                `Apexテスト ${summary.testsCompleted} / ${summary.testsTotal}件、失敗 0件`
        );
        return 0;
    } catch (error) {
        writeError(`エラー: ${error.message}`);
        return 1;
    }
}

module.exports = {
    describeDeployProgress,
    getReportCommand,
    parseSfJson,
    registerInterruptHandler,
    runAndMonitorDeploy,
    validateProgressResult,
    validateSuccessfulDeployResult
};
