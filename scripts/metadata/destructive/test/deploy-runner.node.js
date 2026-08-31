// 実行コマンド: node --test scripts/metadata/destructive/test/deploy-runner.node.js
// 用途: destructive deployの開始、完了監視、job完了結果の検証を確認する。

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    deployOperations,
    getReportCommand,
    runAndMonitorDeploy,
    validateSuccessfulDeployResult
} = require('../internal/deploy-runner');

const deployId = '0Af000000000001AAA';

// Salesforce CLIのJSON応答を子プロセスの戻り値形式で作成する。
function createSfResult(result, status = 0) {
    return {
        status,
        stderr: '',
        stdout: JSON.stringify({ status, result })
    };
}

// Salesforce CLIが返す完了済みdeploy結果を作成する。
function createSuccessfulDeployResult(overrides = {}) {
    return {
        id: deployId,
        status: 'Succeeded',
        success: true,
        done: true,
        checkOnly: false,
        numberComponentsDeployed: 2,
        numberComponentsTotal: 2,
        ...overrides
    };
}

// TTY表示に依存せず進捗の更新と完了を記録する。
function createReporter() {
    const updates = [];
    const finishes = [];

    return {
        reporter: {
            update(message) {
                updates.push(message);
            },
            finish(message) {
                finishes.push(message);
            }
        },
        updates,
        finishes
    };
}

test('destructive deployを非同期で開始し、完了まで監視してjob結果を検証する', async () => {
    const jsonCommands = [];
    const waits = [];
    const lines = [];
    const reporter = createReporter();
    const progressResult = createSuccessfulDeployResult({
        status: 'InProgress',
        success: false,
        done: false,
        numberComponentsDeployed: 1
    });
    const results = [
        createSfResult({ id: deployId, status: 'Queued', done: false }),
        createSfResult(progressResult, 69),
        createSfResult(createSuccessfulDeployResult())
    ];

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        operation: deployOperations.DEPLOY,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand(args, workingDirectory, spawnCommand, maxBuffer, timeout) {
            jsonCommands.push({ args, workingDirectory, spawnCommand, maxBuffer, timeout });
            return results.shift();
        },
        async waitForNextPoll(milliseconds) {
            waits.push(milliseconds);
        },
        registerInterrupt() {
            return () => {};
        },
        progressReporter: reporter.reporter,
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 0);
    assert.deepEqual(jsonCommands[0].args.slice(-2), ['--async', '--json']);
    assert.equal(jsonCommands[0].args.includes('--dry-run'), false);
    assert.deepEqual(jsonCommands[1].args, [
        'project',
        'deploy',
        'report',
        '--job-id',
        deployId,
        '--target-org',
        'test-org',
        '--json'
    ]);
    assert.deepEqual(waits, [5_000]);
    assert.match(reporter.updates[0], /metadata 1 \/ 2件（InProgress）/);
    assert.match(reporter.finishes[0], /Succeeded/);
    assert.deepEqual(lines, [`deploy job ID: ${deployId}`]);
    assert.equal(
        jsonCommands.every(({ maxBuffer }) => maxBuffer === 50 * 1024 * 1024),
        true
    );
    assert.equal(
        jsonCommands.every(({ timeout }) => timeout === 120_000),
        true
    );
});

test('dry-run開始時だけdry-runフラグを追加し、checkOnly成功結果を要求する', async () => {
    const commands = [];
    const results = [
        createSfResult({ id: deployId, status: 'Queued', done: false }),
        createSfResult(createSuccessfulDeployResult({ checkOnly: true }))
    ];

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        operation: deployOperations.DRY_RUN,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand(args) {
            commands.push(args);
            return results.shift();
        },
        registerInterrupt() {
            return () => {};
        },
        progressReporter: createReporter().reporter,
        writeLine() {}
    });

    assert.equal(status, 0);
    assert.deepEqual(commands[0].slice(-3), ['--dry-run', '--async', '--json']);
});

test('開始コマンドがタイムアウトした場合は開始状況不明として自動再実行を禁止する', async () => {
    const lines = [];
    const errors = [];
    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        operation: deployOperations.DEPLOY,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return {
                status: null,
                stderr: '',
                stdout: '',
                error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })
            };
        },
        writeLine(message) {
            lines.push(message);
        },
        writeError(message) {
            errors.push(message);
        }
    });

    assert.equal(status, 1);
    assert.match(errors[0], /timed out/);
    assert.match(lines[0], /開始状況を確認できません/);
    assert.match(lines[1], /Deployment Status/);
});

test('解析できたCLIエラーは開始失敗として扱い、開始状況不明とは案内しない', async () => {
    const lines = [];
    const errors = [];
    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        operation: deployOperations.DEPLOY,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return {
                status: 1,
                stderr: '',
                stdout: JSON.stringify({ status: 1, message: 'manifest error' })
            };
        },
        writeLine(message) {
            lines.push(message);
        },
        writeError(message) {
            errors.push(message);
        }
    });

    assert.equal(status, 1);
    assert.match(errors[0], /開始に失敗しました: manifest error/);
    assert.deepEqual(lines, []);
});

test('監視応答を解析できない場合は組織側の継続可能性と結果確認コマンドを表示する', async () => {
    const lines = [];
    const errors = [];
    const reporter = createReporter();
    const results = [createSfResult({ id: deployId }), { status: 1, stderr: '', stdout: 'not-json' }];

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        operation: deployOperations.DEPLOY,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return results.shift();
        },
        registerInterrupt() {
            return () => {};
        },
        progressReporter: reporter.reporter,
        writeLine(message) {
            lines.push(message);
        },
        writeError(message) {
            errors.push(message);
        }
    });

    assert.equal(status, 1);
    assert.match(reporter.finishes[0], /進捗監視を終了/);
    assert.match(errors[0], /JSONを解析できません/);
    assert.deepEqual(lines.slice(-2), [
        '組織上のdeployは継続している可能性があります。',
        `結果確認: ${getReportCommand(deployId, 'test-org')}`
    ]);
});

test('Ctrl+Cではローカル監視だけを停止し、結果確認コマンドを表示する', async () => {
    const lines = [];
    const reporter = createReporter();
    const results = [
        createSfResult({ id: deployId }),
        createSfResult(
            createSuccessfulDeployResult({
                status: 'InProgress',
                success: false,
                done: false,
                numberComponentsDeployed: 1
            }),
            69
        )
    ];
    let interrupt;
    let waitWasAborted = false;

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        operation: deployOperations.DEPLOY,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return results.shift();
        },
        registerInterrupt(handler) {
            interrupt = handler;
            return () => {};
        },
        waitForNextPoll(milliseconds, signal) {
            assert.equal(milliseconds, 5_000);
            interrupt();

            return new Promise((resolve) => {
                signal.addEventListener(
                    'abort',
                    () => {
                        waitWasAborted = true;
                        resolve();
                    },
                    { once: true }
                );
            });
        },
        progressReporter: reporter.reporter,
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 130);
    assert.equal(waitWasAborted, true);
    assert.match(reporter.finishes.at(-1), /組織上のdeployは継続/);
    assert.equal(lines.at(-1), `結果確認: ${getReportCommand(deployId, 'test-org')}`);
});

for (const [name, overrides, message] of [
    ['dry-run種別が不一致', { checkOnly: true }, /dry-run種別が開始時の指定と一致しません/],
    ['最終状態が部分成功', { status: 'SucceededPartial' }, /成功状態ではありません/]
]) {
    test(`${name}の完了結果は拒否する`, () => {
        assert.throws(
            () =>
                validateSuccessfulDeployResult({
                    result: createSuccessfulDeployResult(overrides),
                    deployId,
                    operation: deployOperations.DEPLOY
                }),
            message
        );
    });
}
