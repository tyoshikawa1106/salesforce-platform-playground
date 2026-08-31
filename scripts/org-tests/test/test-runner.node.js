// 実行コマンド: node --test scripts/org-tests/test/test-runner.node.js
// 用途: ApexテストとFlowテストに共通する非同期開始、進捗監視、結果取得を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { getResultCommand, runAndMonitorTests, sfCommandTimeoutMs } = require('../internal/test-runner');
const { createSfResult } = require('./test-helper');

// SalesforceのテストランIDとして扱える固定値を使用する。
const testRunId = '707000000000001AAA';

// 進捗表示を検証できる記録用レポーターを作成する。
function createProgressReporter() {
    const messages = [];

    return {
        messages,
        reporter: {
            finish(message) {
                messages.push({ message, type: 'finish' });
            },
            update(message) {
                messages.push({ message, type: 'update' });
            }
        }
    };
}

for (const testType of ['apex', 'flow']) {
    test(`${testType}テストを開始し、進捗完了後に最終結果を取得する`, async () => {
        const asyncOutputCalls = [];
        const resultCalls = [];
        const resultTimeouts = [];
        const lines = [];
        const progress = createProgressReporter();
        let progressCount = 0;

        const status = await runAndMonitorTests({
            testType,
            targetOrg: 'test-org',
            repoRoot: '/repo',
            runSfWithOutputAsyncCommand(args, cwd, execCommand, maxBuffer, timeout, signal) {
                asyncOutputCalls.push({ args, signal, timeout });

                if (args[0] === testType) {
                    return createSfResult({ testRunId });
                }

                progressCount += 1;
                return createSfResult({
                    records: [
                        {
                            ClassesCompleted: progressCount === 1 ? 1 : 3,
                            ClassesEnqueued: 3,
                            Status: progressCount === 1 ? 'Processing' : 'Completed'
                        }
                    ]
                });
            },
            runSfCommand(args, cwd, spawnCommand, timeout) {
                resultCalls.push(args);
                resultTimeouts.push(timeout);
                return 0;
            },
            waitForNextPoll: async () => {},
            registerInterrupt: () => () => {},
            progressReporter: progress.reporter,
            writeLine(message) {
                lines.push(message);
            }
        });

        assert.equal(status, 0);
        assert.deepEqual(asyncOutputCalls[0].args, [
            testType,
            'run',
            'test',
            '--test-level',
            'RunLocalTests',
            '--code-coverage',
            '--target-org',
            'test-org',
            '--json'
        ]);
        assert.equal(asyncOutputCalls[0].timeout, sfCommandTimeoutMs);
        assert.equal(asyncOutputCalls[0].signal.aborted, false);
        const progressCalls = asyncOutputCalls.filter(({ args }) => args[4].includes('FROM ApexTestRunResult'));
        assert.equal(progressCalls.length, 2);
        assert.equal(progressCalls[0].args[0], 'data');
        assert.equal(progressCalls[0].timeout, sfCommandTimeoutMs);

        assert.deepEqual(resultCalls, [
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
                'test-org'
            ]
        ]);
        assert.equal(progress.messages.length, 2);
        assert.equal(progress.messages[0].type, 'update');
        assert.match(
            progress.messages[0].message,
            /^進捗: 1 \/ 3件完了（実行中）｜\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/
        );
        assert.equal(progress.messages[1].type, 'finish');
        assert.match(
            progress.messages[1].message,
            /^進捗: 3 \/ 3件完了（完了）｜\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/
        );
        assert.deepEqual(resultTimeouts, [sfCommandTimeoutMs]);
        assert.deepEqual(lines, [`テストランID: ${testRunId}`]);
    });
}

test('開始処理中のCtrl+CではCLIを中断して開始状況不明を案内する', async () => {
    const lines = [];
    const resultCalls = [];
    let interruptHandler;
    let startSignal;

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand(args, cwd, execCommand, maxBuffer, timeout, signal) {
            startSignal = signal;
            return new Promise((resolve) => {
                signal.addEventListener(
                    'abort',
                    () =>
                        resolve({
                            error: Object.assign(new Error('The operation was aborted'), { code: 'ABORT_ERR' }),
                            status: null,
                            stderr: '',
                            stdout: ''
                        }),
                    { once: true }
                );
                interruptHandler();
            });
        },
        runSfCommand(args) {
            resultCalls.push(args);
            return 0;
        },
        registerInterrupt(handler) {
            interruptHandler = handler;
            return () => {};
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 130);
    assert.equal(startSignal.aborted, true);
    assert.deepEqual(resultCalls, []);
    assert.deepEqual(lines, [
        'Apexテストの開始結果を取得できませんでした。組織上では開始されている可能性があります。',
        '重複実行を避けるため、再実行する前にSalesforceの「Apexテスト実行」で状況を確認してください。'
    ]);
});

test('進捗照会中のCtrl+CではCLIを中断して手動の結果取得コマンドを表示する', async () => {
    const lines = [];
    const resultCalls = [];
    const progress = createProgressReporter();
    let interruptHandler;
    let progressSignal;

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand(args, cwd, execCommand, maxBuffer, timeout, signal) {
            if (args[0] === 'apex') {
                return createSfResult({ testRunId });
            }

            progressSignal = signal;
            return new Promise((resolve) => {
                signal.addEventListener(
                    'abort',
                    () =>
                        resolve({
                            error: Object.assign(new Error('The operation was aborted'), { code: 'ABORT_ERR' }),
                            status: null,
                            stderr: '',
                            stdout: ''
                        }),
                    { once: true }
                );
                interruptHandler();
            });
        },
        runSfCommand(args) {
            resultCalls.push(args);
            return 0;
        },
        registerInterrupt(handler) {
            interruptHandler = handler;
            return () => {};
        },
        progressReporter: progress.reporter,
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 130);
    assert.equal(progressSignal.aborted, true);
    assert.deepEqual(resultCalls, []);
    assert.deepEqual(progress.messages, [
        { message: '進捗監視を終了しました。組織上のテストは継続しています。', type: 'finish' }
    ]);
    assert.deepEqual(lines, [
        `テストランID: ${testRunId}`,
        `結果確認: ${getResultCommand('apex', testRunId, 'test-org')}`
    ]);
});

test('poll待機中のCtrl+Cでは待機タイマーを中断する', async () => {
    let interruptHandler;
    let pollSignal;

    const status = await runAndMonitorTests({
        testType: 'flow',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand(args) {
            if (args[0] === 'flow') {
                return createSfResult({ testRunId });
            }

            return createSfResult({
                records: [{ ClassesCompleted: 1, ClassesEnqueued: 3, Status: 'Processing' }]
            });
        },
        waitForNextPoll(milliseconds, signal) {
            pollSignal = signal;
            interruptHandler();
            return Promise.resolve();
        },
        registerInterrupt(handler) {
            interruptHandler = handler;
            return () => {};
        },
        progressReporter: createProgressReporter().reporter,
        writeLine() {}
    });

    assert.equal(status, 130);
    assert.equal(pollSignal.aborted, true);
});

test('開始結果が707形式のテストランIDでない場合は監視を開始しない', async () => {
    const errors = [];
    const lines = [];
    let commandCount = 0;

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand() {
            commandCount += 1;
            return createSfResult({ testRunId: '001000000000001AAA' });
        },
        writeError(message) {
            errors.push(message);
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.equal(commandCount, 1);
    assert.deepEqual(errors, ['エラー: テストランIDを取得できませんでした。']);
    assert.deepEqual(lines, [
        'Apexテストの開始結果を取得できませんでした。組織上では開始されている可能性があります。',
        '重複実行を避けるため、再実行する前にSalesforceの「Apexテスト実行」で状況を確認してください。'
    ]);
});

for (const [responseLabel, stdout] of [
    ['statusがないobject', '{}'],
    ['null', 'null']
]) {
    test(`開始応答が${responseLabel}の場合は開始状況不明として案内する`, async () => {
        const errors = [];
        const lines = [];

        const status = await runAndMonitorTests({
            testType: 'apex',
            targetOrg: 'test-org',
            repoRoot: '/repo',
            runSfWithOutputAsyncCommand() {
                return { status: 0, stderr: '', stdout };
            },
            writeError(message) {
                errors.push(message);
            },
            writeLine(message) {
                lines.push(message);
            }
        });

        assert.equal(status, 1);
        assert.deepEqual(errors, ['エラー: ApexテストのJSON応答を解釈できませんでした。']);
        assert.deepEqual(lines, [
            'Apexテストの開始結果を取得できませんでした。組織上では開始されている可能性があります。',
            '重複実行を避けるため、再実行する前にSalesforceの「Apexテスト実行」で状況を確認してください。'
        ]);
    });
}

test('開始コマンドがタイムアウトした場合は開始状況不明として自動再実行を禁止する', async () => {
    const errors = [];
    const lines = [];
    const timeoutError = Object.assign(new Error('sf ETIMEDOUT'), { code: 'ETIMEDOUT' });

    const status = await runAndMonitorTests({
        testType: 'flow',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand() {
            return { error: timeoutError, status: null, stderr: '', stdout: '' };
        },
        writeError(message) {
            errors.push(message);
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.match(errors[0], /Flowテストを開始できませんでした: sf ETIMEDOUT/);
    assert.deepEqual(lines, [
        'Flowテストの開始結果を取得できませんでした。組織上では開始されている可能性があります。',
        '重複実行を避けるため、再実行する前にSalesforceのテスト実行状況を確認してください。'
    ]);
});

test('構造化された開始失敗は開始状況不明として案内しない', async () => {
    const errors = [];
    const lines = [];

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand() {
            return {
                status: 1,
                stderr: '',
                stdout: JSON.stringify({ message: 'There are no Apex tests to run in this org.', status: 1 })
            };
        },
        writeError(message) {
            errors.push(message);
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.match(errors[0], /Apexテストに失敗しました: There are no Apex tests/);
    assert.deepEqual(lines, []);
});

test('最終結果コマンドが失敗した場合は同じテストランIDの結果確認コマンドを表示する', async () => {
    const lines = [];

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand(args) {
            if (args[0] === 'apex') {
                return createSfResult({ testRunId });
            }

            return createSfResult({
                records: [{ ClassesCompleted: 3, ClassesEnqueued: 3, Status: 'Completed' }]
            });
        },
        runSfCommand() {
            return 1;
        },
        registerInterrupt: () => () => {},
        progressReporter: createProgressReporter().reporter,
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.deepEqual(lines, [
        `テストランID: ${testRunId}`,
        `結果確認: ${getResultCommand('apex', testRunId, 'test-org')}`
    ]);
});

test('進捗取得に失敗した場合は監視を終了し、手動の結果取得方法を表示する', async () => {
    const errors = [];
    const lines = [];
    const progress = createProgressReporter();

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputAsyncCommand(args) {
            if (args[0] === 'apex') {
                return createSfResult({ testRunId });
            }

            return { status: 0, stderr: '', stdout: 'not-json' };
        },
        registerInterrupt: () => () => {},
        progressReporter: progress.reporter,
        writeError(message) {
            errors.push(message);
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.deepEqual(progress.messages, [{ message: '組織テストの進捗監視を終了しました。', type: 'finish' }]);
    assert.match(errors[0], /組織テスト進捗の取得のJSONを解析できませんでした/);
    assert.deepEqual(lines, [
        `テストランID: ${testRunId}`,
        '組織上のテストは継続している可能性があります。',
        `結果確認: ${getResultCommand('apex', testRunId, 'test-org')}`
    ]);
});
