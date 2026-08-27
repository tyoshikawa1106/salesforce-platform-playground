// 実行コマンド: node --test scripts/metadata/destructive/test/deploy-runner.node.js
// 用途: destructive deployの開始、完了監視、削除対象とApexテスト結果の構造検証を確認する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { getReportCommand, runAndMonitorDeploy, validateSuccessfulDeployResult } = require('../internal/deploy-runner');

const deployId = '0Af000000000001AAA';
const expectedComponents = [
    { type: 'ApexClass', fullName: 'OldClass' },
    { type: 'CustomField', fullName: 'Account.OldField__c' }
];

// Salesforce CLIのJSON応答を子プロセスの戻り値形式で作成する。
function createSfResult(result, status = 0) {
    return {
        status,
        stderr: '',
        stdout: JSON.stringify({ status, result })
    };
}

// 安全契約をすべて満たす完了済みdeploy結果を作成する。
function createSuccessfulDeployResult(overrides = {}) {
    return {
        id: deployId,
        status: 'Succeeded',
        success: true,
        done: true,
        checkOnly: false,
        ignoreWarnings: false,
        rollbackOnError: true,
        numberComponentErrors: 0,
        numberComponentsDeployed: 2,
        numberComponentsTotal: 2,
        numberTestErrors: 0,
        numberTestsCompleted: 4,
        numberTestsTotal: 4,
        runTestsEnabled: true,
        files: [{ state: 'Deleted', type: 'ApexClass', fullName: 'OldClass' }],
        details: {
            componentSuccesses: {
                deleted: 'true',
                componentType: 'CustomField',
                fullName: 'Account.OldField__c'
            },
            runTestResult: {
                numFailures: '0',
                numTestsRun: '4',
                totalTime: '100'
            }
        },
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

test('destructive deployを非同期で開始し、完了まで監視して削除とApexテストを検証する', async () => {
    const jsonCommands = [];
    const humanCommands = [];
    const waits = [];
    const lines = [];
    const reporter = createReporter();
    const progressResult = createSuccessfulDeployResult({
        status: 'InProgress',
        success: false,
        done: false,
        numberComponentsDeployed: 1,
        numberTestsCompleted: 2
    });
    const results = [
        createSfResult({ id: deployId, status: 'Queued', done: false }),
        createSfResult(progressResult, 69),
        createSfResult(createSuccessfulDeployResult())
    ];

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start', '--test-level', 'RunLocalTests'],
        dryRun: false,
        expectedComponents,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand(args, workingDirectory, spawnCommand, maxBuffer, timeout) {
            jsonCommands.push({ args, workingDirectory, spawnCommand, maxBuffer, timeout });
            return results.shift();
        },
        runSfCommand(args, workingDirectory, spawnCommand, timeout) {
            humanCommands.push({ args, workingDirectory, spawnCommand, timeout });
            return 0;
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
    assert.match(reporter.updates[0], /metadata 1 \/ 2件、Apex 2 \/ 4件（InProgress）/);
    assert.match(reporter.finishes[0], /Succeeded/);
    assert.deepEqual(humanCommands, [
        {
            args: ['project', 'deploy', 'report', '--job-id', deployId, '--target-org', 'test-org'],
            workingDirectory: '/repo',
            spawnCommand: undefined,
            timeout: 120_000
        }
    ]);
    assert.deepEqual(lines, [`deploy job ID: ${deployId}`, '検証結果: 削除対象 2件、Apexテスト 4 / 4件、失敗 0件']);
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
        dryRun: true,
        expectedComponents,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand(args) {
            commands.push(args);
            return results.shift();
        },
        runSfCommand() {
            return 0;
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

test('開始結果から有効なdeploy job IDを取得できない場合は監視を開始しない', async () => {
    await assert.rejects(
        () =>
            runAndMonitorDeploy({
                deployArgs: ['project', 'deploy', 'start'],
                dryRun: false,
                expectedComponents,
                targetOrg: 'test-org',
                repoRoot: '/repo',
                runSfWithOutputCommand() {
                    return createSfResult({ id: 'invalid' });
                }
            }),
        /deploy job IDを取得できません/
    );
});

test('監視応答を解析できない場合は組織側の継続可能性と結果確認コマンドを表示する', async () => {
    const lines = [];
    const errors = [];
    const reporter = createReporter();
    const results = [createSfResult({ id: deployId }), { status: 1, stderr: '', stdout: 'not-json' }];

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        dryRun: false,
        expectedComponents,
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

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        dryRun: false,
        expectedComponents,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return createSfResult({ id: deployId });
        },
        registerInterrupt(handler) {
            handler();
            return () => {};
        },
        progressReporter: reporter.reporter,
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 130);
    assert.match(reporter.finishes[0], /組織上のdeployは継続/);
    assert.equal(lines.at(-1), `結果確認: ${getReportCommand(deployId, 'test-org')}`);
});

test('30分で進捗監視を終了し、組織側の結果確認コマンドを表示する', async () => {
    const lines = [];
    const errors = [];
    const reporter = createReporter();
    const times = [0, 30 * 60 * 1_000];

    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        dryRun: false,
        expectedComponents,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return createSfResult({ id: deployId });
        },
        getCurrentTime() {
            return times.shift();
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

    assert.equal(status, 124);
    assert.match(reporter.finishes[0], /タイムアウト/);
    assert.match(errors[0], /30分でタイムアウト/);
    assert.deepEqual(lines.slice(-2), [
        '組織上のdeployは継続している可能性があります。',
        `結果確認: ${getReportCommand(deployId, 'test-org')}`
    ]);
});

test('完了報告コマンドが失敗した場合は構造検証を成功扱いしない', async () => {
    const results = [createSfResult({ id: deployId }), createSfResult(createSuccessfulDeployResult())];
    const status = await runAndMonitorDeploy({
        deployArgs: ['project', 'deploy', 'start'],
        dryRun: false,
        expectedComponents,
        targetOrg: 'test-org',
        repoRoot: '/repo',
        runSfWithOutputCommand() {
            return results.shift();
        },
        runSfCommand() {
            return 1;
        },
        registerInterrupt() {
            return () => {};
        },
        progressReporter: createReporter().reporter,
        writeLine() {}
    });

    assert.equal(status, 1);
});

test('manifestの削除対象が完了結果にない場合は拒否する', () => {
    assert.throws(
        () =>
            validateSuccessfulDeployResult({
                result: createSuccessfulDeployResult({
                    files: [],
                    details: { ...createSuccessfulDeployResult().details, componentSuccesses: [] }
                }),
                deployId,
                dryRun: false,
                expectedComponents
            }),
        /削除結果を確認できません/
    );
});

for (const [name, overrides, message] of [
    ['metadata componentが未完了', { numberComponentsDeployed: 1 }, /metadata componentの全件完了を確認できません/],
    ['Apexテストが0件', { numberTestsCompleted: 0, numberTestsTotal: 0 }, /全件完了を確認できません/],
    ['Apexテスト失敗がある', { numberTestErrors: 1 }, /numberTestErrorsが0ではありません/],
    ['全体ロールバックが無効', { rollbackOnError: false }, /全体ロールバックを保証できません/],
    ['dry-run種別が不一致', { checkOnly: true }, /dry-run種別が開始時の指定と一致しません/],
    ['最終状態が部分成功', { status: 'SucceededPartial' }, /成功状態ではありません/]
]) {
    test(`${name}の完了結果は拒否する`, () => {
        assert.throws(
            () =>
                validateSuccessfulDeployResult({
                    result: createSuccessfulDeployResult(overrides),
                    deployId,
                    dryRun: false,
                    expectedComponents
                }),
            message
        );
    });
}
