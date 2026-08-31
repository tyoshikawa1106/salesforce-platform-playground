// 実行方法: ApexテストとFlowテストの実行入口から読み込む。
// 用途: 組織テストを非同期で開始し、進捗監視後に最終結果を表示する。

const { setTimeout: wait } = require('node:timers/promises');
const { runSf, runSfWithOutputAsync } = require('../../common/run-command');
const { createProgressReporter, describeTestRunProgress, getTestRunProgress, parseSfJson } = require('./test-progress');

// Salesforce CLIへ問い合わせる間隔を5秒に揃える。
const pollIntervalMs = 5_000;
// 1回のSalesforce CLI呼び出しが停止した場合は2分で終了する。
const sfCommandTimeoutMs = 2 * 60 * 1_000;

// Ctrl+Cで監視を終了するときに、次回pollまでの待機も中断できるPromiseを返す。
function waitForPoll(milliseconds, signal) {
    return wait(milliseconds, undefined, { signal });
}

// Ctrl+Cでは組織上のテストを止めず、ローカル処理だけを止められるハンドラーを登録する。
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

// 開始処理の失敗時に、組織上のテストが登録された可能性を判定する。
function isStartStateUnknown(result) {
    // 呼び出し結果自体がない場合は組織上の開始成否を推測しない。
    if (!result || typeof result !== 'object') {
        // 重複実行を避けるため開始状況不明として扱う。
        return true;
    }

    // timeoutなどでは、子プロセス終了前にテストが登録された可能性が残る。
    if (result.error) {
        // CLI未導入と実行権限不足は、組織へ開始要求を送っていない確定失敗として扱う。
        return result.error.code !== 'ENOENT' && result.error.code !== 'EACCES';
    }

    // JSON本文を構造化された失敗応答かの判定に使用する。
    let parsed;

    // JSONを解析できない応答から開始成否を推測しない。
    try {
        parsed = JSON.parse(result.stdout || '');
    } catch {
        // 応答を解析できない場合は開始されていないと断定しない。
        return true;
    }

    // 数値の非0 statusがあるJSONだけをSalesforce CLIが確定した開始失敗として扱う。
    if (typeof parsed?.status === 'number' && parsed.status !== 0) {
        // 組織上で開始していないことを構造化応答から判断できる。
        return false;
    }

    // status欠落、null、成功応答のID不備はすべて開始状況不明として扱う。
    return true;
}

// 開始結果が不明な場合に、重複実行を避けるための確認先を案内する。
function writeUnknownStartState(testType, testLabel, writeLine) {
    // 組織上のテスト開始可能性をテスト種別付きで表示する。
    writeLine(`${testLabel}テストの開始結果を取得できませんでした。組織上では開始されている可能性があります。`);

    // Apexでは管理画面の確認先を明示する。
    if (testType === 'apex') {
        // Apexテスト実行画面で重複実行の有無を確認するよう案内する。
        writeLine('重複実行を避けるため、再実行する前にSalesforceの「Apexテスト実行」で状況を確認してください。');
        // Flow向けの共通案内を重ねて表示しない。
        return;
    }

    // Flowでは対象組織のテスト実行状況を確認するよう案内する。
    writeLine('重複実行を避けるため、再実行する前にSalesforceのテスト実行状況を確認してください。');
}

// ApexまたはFlowのローカルテストを開始し、完了まで進捗を監視する。
async function runAndMonitorTests({
    testType,
    targetOrg,
    repoRoot,
    runSfCommand = runSf,
    runSfWithOutputAsyncCommand = runSfWithOutputAsync,
    waitForNextPoll = waitForPoll,
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
    const testLabel = testType === 'apex' ? 'Apex' : 'Flow';
    // Ctrl+C通知を開始処理とpoll待機で共有するため、flagとPromiseの両方を用意する。
    let interrupted = false;
    // Promiseを解決する関数をSIGINT handlerから参照できるよう保持する。
    let notifyInterrupted;
    // 開始、進捗照会、poll待機をCtrl+Cで中断するため、現在のAbortControllerを保持する。
    let activeAbortController;
    // poll待機と競合させる中断通知Promiseを作成する。
    const interruptedPromise = new Promise((resolve) => {
        // poll待機中でもSIGINTからPromise.raceを完了できる状態にする。
        notifyInterrupted = resolve;
    });
    // SIGINT受信時は組織上のテストを停止せず、実行中のローカルCLIだけを終了させる。
    const unregisterInterrupt = registerInterrupt(() => {
        // 開始処理またはpoll loopが後続処理へ進まない中断状態へ更新する。
        interrupted = true;
        // 待機中のPromise.raceを即時に完了させる。
        notifyInterrupted();
        // 実行中の開始、進捗照会、poll待機を終了する。
        activeAbortController?.abort();
    });
    // 開始応答から確定したIDを監視と結果取得で共有する。
    let testRunId;

    // 開始、監視、例外のすべてでSIGINT handlerを確実に解除できる範囲を開始する。
    try {
        // 開始CLIの応答待ちもCtrl+Cで中断できるよう、非同期実行へsignalを渡す。
        const startAbortController = new AbortController();
        activeAbortController = startAbortController;
        let startCommandResult;

        try {
            startCommandResult = await runSfWithOutputAsyncCommand(
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
                repoRoot,
                undefined,
                undefined,
                sfCommandTimeoutMs,
                startAbortController.signal
            );
        } finally {
            // 完了した開始CLIを後続のCtrl+C対象から外す。
            if (activeAbortController === startAbortController) {
                activeAbortController = undefined;
            }
        }

        // 開始応答を受け取る前のCtrl+Cでは、組織上の開始成否を推測しない。
        if (interrupted) {
            writeUnknownStartState(testType, testLabel, writeLine);
            return 130;
        }

        try {
            // 応答から取得したIDを、後続のSOQLとCLI引数に使用する前に検証する。
            testRunId = parseSfJson(startCommandResult, `${testLabel}テスト`)?.testRunId;

            // AsyncApexJobに対応する707始まりの15桁または18桁だけを受け付ける。
            if (typeof testRunId !== 'string' || !/^707[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(testRunId)) {
                // 不正なIDでTooling APIを照会せず停止する。
                throw new Error('テストランIDを取得できませんでした。');
            }
        } catch (error) {
            // 開始失敗または開始状況不明の原因を表示する。
            writeError(`エラー: ${error.message}`);

            // 応答を確定できない場合は重複した全件テストを自動または安易に再実行させない。
            if (isStartStateUnknown(startCommandResult)) {
                writeUnknownStartState(testType, testLabel, writeLine);
            }

            // 組織上の開始状態を成功とみなさず非0終了を返す。
            return 1;
        }

        // 手動確認にも使えるテストランIDを開始直後に表示する。
        writeLine(`テストランID: ${testRunId}`);

        // 中断されるまで進捗を一定間隔で取得する。
        while (!interrupted) {
            // 1回分のTooling API進捗を保持する。
            let progress;
            // 進捗照会中のCtrl+Cを非同期CLIへ伝える。
            const progressAbortController = new AbortController();
            activeAbortController = progressAbortController;

            // 進捗取得失敗を組織テスト自体の失敗と区別する。
            try {
                // 開始時に確定したrun IDだけを終了判定の対象にする。
                progress = await getTestRunProgress({
                    repoRoot,
                    runSfWithOutputCommand: runSfWithOutputAsyncCommand,
                    sfCommandTimeoutMs,
                    signal: progressAbortController.signal,
                    targetOrg,
                    testRunId
                });
            } catch (error) {
                // Ctrl+Cによる照会中断は監視エラーにせず、共通の中断案内へ進む。
                if (interrupted) {
                    break;
                }

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
            } finally {
                // 完了した進捗照会を後続のCtrl+C対象から外す。
                if (activeAbortController === progressAbortController) {
                    activeAbortController = undefined;
                }
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

            // 中断通知が先に完了した場合に、未完了の待機タイマーも解除できるようにする。
            const pollAbortController = new AbortController();
            activeAbortController = pollAbortController;
            // 設定間隔またはSIGINTの早い方まで非同期に待機する。
            try {
                await Promise.race([waitForNextPoll(pollIntervalMs, pollAbortController.signal), interruptedPromise]);
            } catch (error) {
                // Ctrl+Cに伴うAbortErrorだけは共通の中断案内へ進める。
                if (!interrupted) {
                    throw error;
                }
            } finally {
                // 完了したpoll待機を後続のCtrl+C対象から外す。
                if (activeAbortController === pollAbortController) {
                    activeAbortController = undefined;
                }
            }
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
    const resultStatus = runSfCommand(
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
        repoRoot,
        undefined,
        sfCommandTimeoutMs
    );

    // テスト失敗または結果取得失敗時も、同じrun IDで結果を再確認できる方法を残す。
    if (resultStatus !== 0) {
        writeLine(`結果確認: ${getResultCommand(testType, testRunId, targetOrg)}`);
    }

    // Salesforce CLIのテスト結果または取得失敗をnpmへそのまま返す。
    return resultStatus;
}

module.exports = {
    getResultCommand,
    registerInterruptHandler,
    runAndMonitorTests,
    sfCommandTimeoutMs
};
