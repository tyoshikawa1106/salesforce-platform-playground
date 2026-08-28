// 実行方法: destructive.jsとテストスクリプトから読み込む。
// 用途: destructive deployのdry-runと実削除を監視して結果を検証する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSfWithOutput } = require('../../../common/run-command');
const { createProgressReporter } = require('../../../org-tests/internal/test-progress');

// Salesforce CLIへ問い合わせる間隔を5秒に揃える。
const pollIntervalMs = 5_000;
// 1回のSalesforce CLI呼び出しが停止した場合は2分で終了する。
const sfCommandTimeoutMs = 2 * 60 * 1_000;
// 監視全体には期限を設けず、長時間の組織処理を完了まで追跡する。
// 大きいdeploy結果でもJSONが途中で切れないよう、明示的な上限を設定する。
const maxJsonBuffer = 50 * 1024 * 1024;
// 実行方法ごとにdry-run種別と表示名を固定する。
const deployOperations = Object.freeze({
    DEPLOY: 'deploy',
    DRY_RUN: 'dry-run'
});
const operationContracts = Object.freeze({
    [deployOperations.DEPLOY]: { checkOnly: false, label: 'destructive deploy' },
    [deployOperations.DRY_RUN]: { checkOnly: true, label: 'dry-run' }
});
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

// Ctrl+Cで監視を終了するときに、次回pollまでの待機も中断できるPromiseを返す。
function waitForPoll(milliseconds, signal) {
    return wait(milliseconds, undefined, { signal });
}

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

// 開始処理の失敗時に、組織上のjobが作成された可能性を判定する。
function isStartStateUnknown(result) {
    if (result.error) {
        // timeoutや出力上限超過では、子プロセス終了前にjobが作成された可能性が残る。
        return result.error.code !== 'ENOENT' && result.error.code !== 'EACCES';
    }

    let parsed;

    try {
        parsed = JSON.parse(result.stdout || '');
    } catch {
        return true;
    }

    // 構造化された非0終了はCLIが確定した開始失敗として扱う。
    return result.status === 0 && parsed.status === 0;
}

// deploy job IDを後続のCLI引数へ渡す前に検証する。
function validateDeployId(deployId) {
    if (typeof deployId !== 'string' || !/^0Af[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(deployId)) {
        throw new Error('deploy job IDを取得できませんでした。');
    }

    return deployId;
}

// 未知の実行方法を暗黙のdeployとして扱わない。
function getOperationContract(operation) {
    const contract = operationContracts[operation];

    if (!contract) {
        throw new Error('destructive deployの実行方法が不正です。');
    }

    return contract;
}

// 監視応答に終了判定と表示に必要な値が揃っていることを確認する。
function validateProgressResult(result, deployId) {
    if (result.id !== deployId) {
        throw new Error('deploy監視結果のjob IDが開始したjobと一致しません。');
    }

    if (typeof result.done !== 'boolean' || typeof result.status !== 'string' || !deployStatuses.has(result.status)) {
        throw new Error('deploy監視結果に有効な完了状態がありません。');
    }

    for (const field of ['numberComponentsDeployed', 'numberComponentsTotal']) {
        if (!Number.isInteger(result[field]) || result[field] < 0) {
            throw new Error(`deploy監視結果の${field}が不正です。`);
        }
    }

    return result;
}

// deployのmetadata件数を1行の進捗へ変換する。
function describeDeployProgress(result) {
    return `進捗: metadata ${result.numberComponentsDeployed} / ${result.numberComponentsTotal}件（${result.status}）`;
}

// Salesforce CLIの成功判定を正とし、完了状態とdry-run種別の整合だけを確認する。
function validateSuccessfulDeployResult({ result, deployId, operation }) {
    const contract = getOperationContract(operation);
    validateProgressResult(result, deployId);

    if (result.done !== true || result.status !== 'Succeeded' || result.success !== true) {
        throw new Error(`deployが成功状態ではありません: ${result.status}`);
    }

    if (result.checkOnly !== contract.checkOnly) {
        throw new Error('deploy結果のdry-run種別が開始時の指定と一致しません。');
    }
}

// deploy job IDを使用した手動の結果取得コマンドを組み立てる。
function getReportCommand(deployId, targetOrg) {
    return `sf project deploy report --job-id ${deployId} --target-org ${targetOrg}`;
}

// destructive deployを非同期で開始し、完了まで監視して成功内容を検証する。
async function runAndMonitorDeploy({
    deployArgs,
    operation,
    targetOrg,
    repoRoot,
    runSfWithOutputCommand = runSfWithOutput,
    waitForNextPoll = waitForPoll,
    registerInterrupt = registerInterruptHandler,
    progressReporter,
    writeLine = console.log,
    writeError = console.error
}) {
    const contract = getOperationContract(operation);

    const reporter = progressReporter ?? createProgressReporter({ writeLine });

    const startArgs = [
        ...deployArgs,
        ...(operation === deployOperations.DRY_RUN ? ['--dry-run'] : []),
        '--async',
        '--json'
    ];
    let deployId;

    const startCommandResult = runSfWithOutputCommand(
        startArgs,
        repoRoot,
        undefined,
        maxJsonBuffer,
        sfCommandTimeoutMs
    );

    try {
        const startResult = parseSfJson(startCommandResult, `${contract.label}の開始`);
        deployId = validateDeployId(startResult.id);
    } catch (error) {
        writeError(`エラー: ${error.message}`);

        if (isStartStateUnknown(startCommandResult)) {
            writeLine(`${contract.label}の開始状況を確認できません。自動で再実行しないでください。`);
            writeLine('SalesforceのDeployment Statusで実行状況を確認してください。');
        }

        return 1;
    }

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
                // reportは処理中でも非0終了するため、JSON resultを取得できた場合は状態判定へ進む。
                finalResult = validateProgressResult(
                    parseSfJson(
                        runSfWithOutputCommand(
                            ['project', 'deploy', 'report', '--job-id', deployId, '--target-org', targetOrg, '--json'],
                            repoRoot,
                            undefined,
                            maxJsonBuffer,
                            sfCommandTimeoutMs
                        ),
                        'deploy進捗の取得',
                        { allowNonZero: true }
                    ),
                    deployId
                );
            } catch (error) {
                reporter.finish(`${contract.label}の進捗監視を終了しました。`);
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
            // 中断通知が先に完了した場合に、未完了の待機タイマーも解除できるようにする。
            const pollAbortController = new AbortController();
            // 次のpoll時刻またはCtrl+Cの早い方まで待機する。
            await Promise.race([waitForNextPoll(pollIntervalMs, pollAbortController.signal), interruptedPromise]);

            // Ctrl+Cで待機を抜けた場合は、Node.jsのevent loopにタイマーを残さない。
            if (interrupted) {
                pollAbortController.abort();
            }
        }

        if (interrupted) {
            reporter.finish('進捗監視を終了しました。組織上のdeployは継続しています。');
            writeLine(`結果確認: ${getReportCommand(deployId, targetOrg)}`);
            return 130;
        }
    } finally {
        unregisterInterrupt();
    }

    try {
        validateSuccessfulDeployResult({
            result: finalResult,
            deployId,
            operation
        });

        return 0;
    } catch (error) {
        writeError(`エラー: ${error.message}`);
        writeLine(`結果確認: ${getReportCommand(deployId, targetOrg)}`);
        return 1;
    }
}

module.exports = {
    deployOperations,
    getReportCommand,
    runAndMonitorDeploy,
    validateSuccessfulDeployResult
};
