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
// 実行種別ごとのcheckOnly値と通知名を対応付ける。
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
    // 待機中も中断signalで監視を終了できるようにする。
    return wait(milliseconds, undefined, { signal });
}

// Ctrl+Cでは監視だけを止められるよう、解除可能なハンドラーを登録する。
function registerInterruptHandler(handler, processRef = process) {
    // 同じ中断を重複処理しないよう1回だけ通知する。
    processRef.once('SIGINT', handler);
    // 通常終了後に他の処理へ中断ハンドラーを残さない。
    return () => processRef.removeListener('SIGINT', handler);
}

// CLIのJSON応答を解析し、外側のstatusとdeploy結果を分けて返す。
function parseSfJson(result, operation, { allowNonZero = false } = {}) {
    // CLI起動失敗と応答解析を分けて扱う。
    if (result.error) {
        // CLIプロセスが返せなかった理由を上位へ伝える。
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    // JSON以外の出力を結果判定に使わない。
    let parsed;

    // JSONとして取得できた情報だけを信頼する。
    try {
        // 空出力も解析失敗として扱う。
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        // 解析不能な応答を成功と誤認させない。
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    // 開始時はプロセスとCLI双方の成功が必要になる。
    if (!allowNonZero && (result.status !== 0 || parsed.status !== 0)) {
        // 利用可能なCLIメッセージだけを理由へ添える。
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        // 失敗応答からjob監視を開始しない。
        throw new Error(`${operation}に失敗しました${detail}`);
    }

    // CLI外側の成功だけでdeploy本体の結果を補完しない。
    if (!parsed.result || typeof parsed.result !== 'object' || Array.isArray(parsed.result)) {
        // 利用可能なCLIメッセージだけを理由へ添える。
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        // 結果本体がなければ安全に監視状態を判断できない。
        throw new Error(`${operation}の応答にresultがありません${detail}`);
    }

    // 検証済みの結果本体を監視処理へ渡す。
    return parsed.result;
}

// 開始処理の失敗時に、組織上のjobが作成された可能性を判定する。
function isStartStateUnknown(result) {
    // CLI起動失敗と応答解析を分けて扱う。
    if (result.error) {
        // timeoutや出力上限超過では、子プロセス終了前にjobが作成された可能性が残る。
        return result.error.code !== 'ENOENT' && result.error.code !== 'EACCES';
    }

    // JSON以外の出力を結果判定に使わない。
    let parsed;

    // JSONとして取得できた情報だけを信頼する。
    try {
        // 空出力も解析失敗として扱う。
        parsed = JSON.parse(result.stdout || '');
    } catch {
        // 非JSON出力では開始済みの可能性を否定できない。
        return true;
    }

    // 数値の非0 statusがなければ、プロセス終了だけで開始失敗を断定しない。
    return typeof parsed?.status !== 'number' || parsed.status === 0;
}

// deploy job IDを後続のCLI引数へ渡す前に検証する。
function validateDeployId(deployId) {
    // 任意文字列をCLI引数へ混入させずMetadata APIのIDだけを許可する。
    if (typeof deployId !== 'string' || !/^0Af[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(deployId)) {
        // 不正なIDでは照会コマンドを組み立てない。
        throw new Error('deploy job IDを取得できませんでした。');
    }

    // 形式確認した照会先を後続処理で共有する。
    return deployId;
}

// 未知の実行方法を暗黙のdeployとして扱わない。
function getOperationContract(operation) {
    // 許可された実行種別だけから成功条件を取得する。
    const contract = operationContracts[operation];

    // 定義されていない操作を削除として扱わない。
    if (!contract) {
        // 意図しない実行方法でCLIへ進まない。
        throw new Error('destructive deployの実行方法が不正です。');
    }

    // 呼び出し元で実行方法と成功条件を一致させる。
    return contract;
}

// 監視応答に終了判定と表示に必要な値が揃っていることを確認する。
function validateProgressResult(result, deployId) {
    // 別jobの成功結果を今回の処理へ流用しない。
    if (result.id !== deployId) {
        // 照会先の不一致を確定的な検証失敗にする。
        throw new Error('deploy監視結果のjob IDが開始したjobと一致しません。');
    }

    // 未知の状態や型不正を完了と推測しない。
    if (typeof result.done !== 'boolean' || typeof result.status !== 'string' || !deployStatuses.has(result.status)) {
        // 状態を判断できなければ手動確認へ切り替える。
        throw new Error('deploy監視結果に有効な完了状態がありません。');
    }

    // 進捗表示に使う件数を同じ条件で確認する。
    for (const field of ['numberComponentsDeployed', 'numberComponentsTotal']) {
        // 負数や小数の件数を正しい進捗として表示しない。
        if (!Number.isInteger(result[field]) || result[field] < 0) {
            // 不正な件数を含む応答では監視を継続しない。
            throw new Error(`deploy監視結果の${field}が不正です。`);
        }
    }

    // 必須情報が揃った監視結果だけを返す。
    return result;
}

// deployのmetadata件数を1行の進捗へ変換する。
function describeDeployProgress(result) {
    // 実行状態と完了件数を同じ進捗行で示す。
    return `進捗: metadata ${result.numberComponentsDeployed} / ${result.numberComponentsTotal}件（${result.status}）`;
}

// Salesforce CLIの成功判定を正とし、完了状態とdry-run種別の整合だけを確認する。
function validateSuccessfulDeployResult({ result, deployId, operation }) {
    // 開始時の実行方法と終了結果を比較する。
    const contract = getOperationContract(operation);
    // job IDと必須情報は成功判定でも省略しない。
    validateProgressResult(result, deployId);

    // 部分成功や未完了を全件成功として扱わない。
    if (result.done !== true || result.status !== 'Succeeded' || result.success !== true) {
        // 完了失敗は次の実削除へ進めない。
        throw new Error(`deployが成功状態ではありません: ${result.status}`);
    }

    // dry-runと実削除の結果が入れ替わっていないことを確認する。
    if (result.checkOnly !== contract.checkOnly) {
        // 実行方法が一致しない結果では成功を返さない。
        throw new Error('deploy結果のdry-run種別が開始時の指定と一致しません。');
    }
}

// deploy job IDを使用した手動の結果取得コマンドを組み立てる。
function getReportCommand(deployId, targetOrg) {
    // 再開始せず同じjobを確認する手順を残す。
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
