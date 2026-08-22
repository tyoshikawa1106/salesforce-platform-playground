// 実行コマンド: node --test scripts/org-tests/test/test-runner.node.js
// 用途: ApexテストとFlowテストに共通する非同期開始、進捗監視、結果取得を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { getResultCommand, runAndMonitorTests } = require('../internal/test-runner');
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
        const outputCalls = [];
        const resultCalls = [];
        const lines = [];
        const progress = createProgressReporter();
        let progressCount = 0;

        const status = await runAndMonitorTests({
            testType,
            targetOrg: 'test-org',
            repoRoot: '/repo',
            runSfWithOutputCommand(args) {
                outputCalls.push(args);

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
            runSfCommand(args) {
                resultCalls.push(args);
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
        assert.deepEqual(outputCalls[0], [
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
        assert.equal(outputCalls[1][0], 'data');
        assert.match(outputCalls[1][4], /FROM ApexTestRunResult/);
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
        assert.deepEqual(progress.messages, [
            { message: '進捗: 1 / 3件完了（実行中）', type: 'update' },
            { message: '進捗: 3 / 3件完了（完了）', type: 'finish' }
        ]);
        assert.deepEqual(lines, [`テストランID: ${testRunId}`]);
    });
}

test('Ctrl+Cでは監視だけを終了して手動の結果取得コマンドを表示する', async () => {
    const lines = [];
    const resultCalls = [];
    const progress = createProgressReporter();
    let interruptHandler;

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand(args) {
            if (args[0] === 'apex') {
                return createSfResult({ testRunId });
            }

            return createSfResult({
                records: [{ ClassesCompleted: 1, ClassesEnqueued: 3, Status: 'Processing' }]
            });
        },
        runSfCommand(args) {
            resultCalls.push(args);
            return 0;
        },
        waitForNextPoll: async () => {
            interruptHandler();
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
    assert.deepEqual(resultCalls, []);
    assert.deepEqual(progress.messages, [
        { message: '進捗: 1 / 3件完了（実行中）', type: 'update' },
        { message: '進捗監視を終了しました。組織上のテストは継続しています。', type: 'finish' }
    ]);
    assert.deepEqual(lines, [
        `テストランID: ${testRunId}`,
        `結果確認: ${getResultCommand('apex', testRunId, 'test-org')}`
    ]);
});

test('開始結果から安全なテストランIDを取得できない場合は監視を開始しない', async () => {
    await assert.rejects(
        () =>
            runAndMonitorTests({
                testType: 'apex',
                targetOrg: 'test-org',
                repoRoot: '/repo',
                runSfWithOutputCommand() {
                    return createSfResult({ testRunId: "invalid' OR Id != ''" });
                }
            }),
        /テストランIDを取得できませんでした/
    );
});

test('進捗取得に失敗した場合は監視を終了し、手動の結果取得方法を表示する', async () => {
    const errors = [];
    const lines = [];
    const progress = createProgressReporter();

    const status = await runAndMonitorTests({
        testType: 'apex',
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand(args) {
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
