// 実行方法: destructive.jsとテストスクリプトから読み込む。
// 用途: destructive deployのdry-runと実削除を監視して結果を検証する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSfWithOutputAsync } = require('../../../common/run-command');
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

// destructive deployを開始前から中断可能にし、完了結果を検証する。
async function runAndMonitorDeploy({
    deployArgs,
    operation,
    targetOrg,
    repoRoot,
    runSfWithOutputCommand = runSfWithOutputAsync,
    waitForNextPoll = waitForPoll,
    registerInterrupt = registerInterruptHandler,
    signal,
    progressReporter,
    writeLine = console.log,
    writeError = console.error
}) {
    // 実行種別に対応する成功条件と表示名を確定する。
    const contract = getOperationContract(operation);
    // TTYと通常出力で同じ進捗を通知する。
    const reporter = progressReporter ?? createProgressReporter({ writeLine });
    // 単独実行時もCLI開始前から中断状態を保持する。
    const controller = new AbortController();
    // 呼び出し元が渡した中断状態をdry-runと実削除で共有する。
    const activeSignal = signal ?? controller.signal;
    // 外部signalがある場合は呼び出し元だけがSIGINTを管理する。
    const unregisterInterrupt = signal ? () => {} : registerInterrupt(() => controller.abort());
    // 開始結果を取得できた場合だけ復旧案内に使用する。
    let deployId;
    // 開始前の中断と開始状況不明を区別する。
    let startAttempted = false;

    // CLIとpollのどの段階でも中断を同じ終了コードへ変換する。
    try {
        // 既に中断されたフローから新しいjobを開始しない。
        activeSignal.throwIfAborted();
        // 非同期job開始とJSON応答を要求する。
        const startArgs = [
            ...deployArgs,
            ...(operation === deployOperations.DRY_RUN ? ['--dry-run'] : []),
            '--async',
            '--json'
        ];
        // この時点以降の中断では組織側の開始可能性を残す。
        startAttempted = true;
        // Node.jsのイベント処理を止めず、Ctrl+CでローカルCLIを終了する。
        const startCommandResult = await runSfWithOutputCommand(
            startArgs,
            repoRoot,
            undefined,
            maxJsonBuffer,
            sfCommandTimeoutMs,
            activeSignal
        );
        // 中断と成功応答が重なった場合も取得できたjob IDを保持する。
        try {
            // CLIが返した開始結果だけからjob IDを検証する。
            const startResult = parseSfJson(startCommandResult, `${contract.label}の開始`);
            // 後続の照会先を開始済みjobへ限定する。
            deployId = validateDeployId(startResult.id);
        } catch (error) {
            // 中断時は通常エラーではなく中断案内へ進む。
            activeSignal.throwIfAborted();
            // 開始失敗の原因を通知する。
            writeError(`エラー: ${error.message}`);
            // timeoutなどでは開始済みの可能性を明示する。
            if (isStartStateUnknown(startCommandResult)) {
                // 重複開始を防ぐため再実行を抑止する。
                writeLine(`${contract.label}の開始状況を確認できません。自動で再実行しないでください。`);
                // job IDを取得できない場合の確認先を示す。
                writeLine('SalesforceのDeployment Statusで実行状況を確認してください。');
            }
            // 開始成功を確認できない場合は後続処理を行わない。
            return 1;
        }
        // 監視と手動確認に使うjob IDを表示する。
        writeLine(`deploy job ID: ${deployId}`);
        // 開始応答が成功でも中断済みなら監視へ進まない。
        activeSignal.throwIfAborted();

        // 期限を設けず、job完了または中断まで照会する。
        while (true) {
            // 中断後に追加のCLIを開始しない。
            activeSignal.throwIfAborted();
            // reportは処理中の非0終了も返すためJSONの状態を検証する。
            const commandResult = await runSfWithOutputCommand(
                ['project', 'deploy', 'report', '--job-id', deployId, '--target-org', targetOrg, '--json'],
                repoRoot,
                undefined,
                maxJsonBuffer,
                sfCommandTimeoutMs,
                activeSignal
            );
            // 成功応答より中断操作を優先する。
            activeSignal.throwIfAborted();
            // 別jobや不完全な応答を成功扱いしない。
            const result = validateProgressResult(
                parseSfJson(commandResult, 'deploy進捗の取得', { allowNonZero: true }),
                deployId
            );
            // 現在件数と状態を表示用に変換する。
            const message = describeDeployProgress(result);
            // 終了したjobだけ成功条件を確認する。
            if (result.done) {
                // 最後の進捗行を確定する。
                reporter.finish(message);
                // 成功状態とdry-run種別が一致することを要求する。
                validateSuccessfulDeployResult({ result, deployId, operation });
                // 表示処理中も含め中断された場合は成功を返さない。
                activeSignal.throwIfAborted();
                // 検証済みの成功だけを呼び出し元へ返す。
                return 0;
            }
            // 未完了の進捗を更新する。
            reporter.update(message);
            // Ctrl+Cでpoll待機も解除し、タイマーを残さない。
            await waitForNextPoll(pollIntervalMs, activeSignal);
        }
    } catch (error) {
        // 開始、照会、待機のどこで中断されても後続処理を停止する。
        if (activeSignal.aborted) {
            // job IDの取得前後で必要な復旧案内を分ける。
            if (deployId) {
                // ローカル中断は組織側のキャンセルではないことを示す。
                reporter.finish('進捗監視を終了しました。組織上のdeployは継続している可能性があります。');
                // 同じjobを照会し、重複実行を避ける。
                writeLine(`結果確認: ${getReportCommand(deployId, targetOrg)}`);
            } else if (startAttempted) {
                // 開始応答が不明な状態で実行し直さないよう案内する。
                writeLine(`${contract.label}の開始状況を確認できません。自動で再実行しないでください。`);
                // IDが不明でも組織の実行履歴から確認できるようにする。
                writeLine('SalesforceのDeployment Statusで実行状況を確認してください。');
            } else {
                // CLI開始前の中断を組織上の処理と混同しない。
                writeLine(`${contract.label}の開始前に中断しました。`);
            }
            // shellと呼び出し元へ中断を伝える。
            return 130;
        }
        // 監視失敗時は進捗表示を終了する。
        reporter.finish(`${contract.label}の進捗監視を終了しました。`);
        // 応答不正や実行失敗の原因を通知する。
        writeError(`エラー: ${error.message}`);
        // 開始済みjobは同じIDで結果を確認する。
        if (deployId) {
            // 監視失敗が組織処理の停止を意味しないことを示す。
            writeLine('組織上のdeployは継続している可能性があります。');
            // 手動確認のために照会コマンドを残す。
            writeLine(`結果確認: ${getReportCommand(deployId, targetOrg)}`);
        } else if (startAttempted) {
            // CLIの例外で開始結果が失われても再実行を抑止する。
            writeLine(`${contract.label}の開始状況を確認できません。自動で再実行しないでください。`);
            // ID未取得時の確認先を表示する。
            writeLine('SalesforceのDeployment Statusで実行状況を確認してください。');
        }
        // 成功未確認の処理は非0で終了する。
        return 1;
    } finally {
        // 単独実行で登録したハンドラーだけを解除する。
        unregisterInterrupt();
    }
}

module.exports = {
    deployOperations,
    getReportCommand,
    registerInterruptHandler,
    runAndMonitorDeploy,
    validateSuccessfulDeployResult
};
