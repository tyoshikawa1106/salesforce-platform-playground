// 実行コマンド: node --test scripts/setup/test/import-test-data.node.js
// 用途: テストデータ投入入口のdry-run、組織制御、失敗時の後始末を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../import-test-data');

// 組織情報や実行予定をテストログへ出さず、入口処理だけを検証する。
function runTest(options) {
    const silentOutput = { write() {} };
    return run({ stderr: silentOutput, stdout: silentOutput, runOrgExplorerSeedCommand: async () => 0, ...options });
}

// 確認への回答を順番に返し、最後にcloseされたことを記録する。
function createPrompt(answers) {
    let closed = false;

    return {
        prompt: {
            async question() {
                return answers.shift();
            },
            close() {
                closed = true;
            }
        },
        isClosed() {
            return closed;
        }
    };
}

// 指定種別の対象組織を含むSalesforce CLI成功結果を作成する。
function createOrgListResult(type = 'sandbox') {
    const baseOrg = {
        alias: 'test-org',
        instanceUrl: 'https://example.my.salesforce.com',
        orgId: '00D000000000001',
        username: 'user@example.com'
    };
    const scratchOrgs = type === 'scratch' ? [{ ...baseOrg, expirationDate: '2099-01-01' }] : [];
    const nonScratchOrg = {
        ...baseOrg,
        isSandbox: type === 'sandbox',
        orgEdition: type === 'developer' ? 'Developer Edition' : 'Enterprise Edition'
    };
    const nonScratchOrgs = type === 'scratch' ? [] : [nonScratchOrg];
    const sandboxes = type === 'sandbox' ? [nonScratchOrg] : [];

    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({
            status: 0,
            result: { nonScratchOrgs, sandboxes, scratchOrgs }
        })
    };
}

// Default Target Orgの取得結果を作成する。
function createDefaultTargetOrgResult() {
    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({
            status: 0,
            result: [{ name: 'target-org', success: true, value: 'test-org' }]
        })
    };
}

// Default Target Orgと組織一覧の取得を共通化し、Apex実行をテストごとに差し替える。
function createRunSfCommand(executeApex, type = 'sandbox') {
    return (args) => {
        if (args[0] === 'config' && args[1] === 'get') {
            return createDefaultTargetOrgResult();
        }

        if (args[0] === 'org' && args[1] === 'list') {
            return createOrgListResult(type);
        }

        return executeApex(args);
    };
}

test('dry-runではSalesforce CLIと入力確認を実行しない', async () => {
    let executionCount = 0;
    let promptCount = 0;

    await runTest({
        argv: ['--dry-run', '--only', 'standard-objects-accounts'],
        createPrompt() {
            promptCount += 1;
        },
        runSfCommand() {
            executionCount += 1;
        }
    });

    assert.equal(executionCount, 0);
    assert.equal(promptCount, 0);
});

test('実投入ではTarget OrgのCLI指定を拒否する', async () => {
    await assert.rejects(
        () => runTest({ argv: ['--target-org', 'test-org', '--only', 'standard-objects-accounts'] }),
        /未対応の引数が指定されました: --target-org/
    );
});

test('ローカルのplan検証に失敗した場合は組織確認と入力確認を開始しない', async () => {
    let promptCount = 0;
    let sfExecutionCount = 0;

    await assert.rejects(
        () =>
            runTest({
                argv: ['--plan', 'scripts/setup/plans/missing-plan.json'],
                createPrompt() {
                    promptCount += 1;
                },
                runSfCommand() {
                    sfExecutionCount += 1;
                }
            }),
        /missing-plan\.json/
    );

    assert.equal(promptCount, 0);
    assert.equal(sfExecutionCount, 0);
});

test('Default Target Orgが未設定の場合は入力確認を開始しない', async () => {
    let promptCount = 0;

    await assert.rejects(
        () =>
            runTest({
                argv: ['--only', 'standard-objects-accounts'],
                createPrompt() {
                    promptCount += 1;
                },
                runSfCommand() {
                    return {
                        status: 0,
                        stderr: '',
                        stdout: JSON.stringify({
                            status: 0,
                            result: [{ name: 'target-org', success: false }]
                        })
                    };
                }
            }),
        /Default Target Orgが設定されていません/
    );

    assert.equal(promptCount, 0);
});

test('接続組織が承認されない場合は実投入しない', async () => {
    let apexExecutionCount = 0;
    const prompt = createPrompt(['n']);

    await runTest({
        argv: ['--only', 'standard-objects-accounts'],
        createPrompt: () => prompt.prompt,
        runSfCommand: createRunSfCommand(() => {
            apexExecutionCount += 1;
        })
    });

    assert.equal(apexExecutionCount, 0);
    assert.equal(prompt.isClosed(), true);
});

test('本番環境は入力確認を開始せず実投入しない', async () => {
    let apexExecutionCount = 0;
    let promptCount = 0;

    await assert.rejects(
        () =>
            runTest({
                argv: ['--only', 'standard-objects-accounts'],
                createPrompt() {
                    promptCount += 1;
                },
                runSfCommand: createRunSfCommand(() => {
                    apexExecutionCount += 1;
                }, 'production')
            }),
        /本番環境へのテストデータ投入は許可されていません/
    );

    assert.equal(apexExecutionCount, 0);
    assert.equal(promptCount, 0);
});

for (const type of ['sandbox', 'scratch', 'developer']) {
    test(`${type}では接続組織の承認後に実投入する`, async () => {
        let apexExecutionCount = 0;
        const prompt = createPrompt(['y']);

        await runTest({
            argv: ['--only', 'standard-objects-accounts'],
            createPrompt: () => prompt.prompt,
            runSfCommand: createRunSfCommand(() => {
                apexExecutionCount += 1;
                return { status: 0, stdout: '', stderr: '' };
            }, type)
        });

        assert.equal(apexExecutionCount, 1);
        assert.equal(prompt.isClosed(), true);
    });
}

test('Scratch Orgセットアップでは内部指定されたaliasを使用する', async () => {
    let configGetCount = 0;
    let apexArgs;
    const prompt = createPrompt(['y']);

    await runTest({
        argv: ['--only', 'standard-objects-accounts'],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            if (args[0] === 'config') {
                configGetCount += 1;
            }
            if (args[0] === 'org' && args[1] === 'list') {
                return createOrgListResult('scratch');
            }

            apexArgs = args;
            return { status: 0, stdout: '', stderr: '' };
        },
        targetOrg: 'test-org'
    });

    assert.equal(configGetCount, 0);
    assert.equal(apexArgs[apexArgs.indexOf('--target-org') + 1], 'test-org');
});

test('Scratch Org準備では標準データ成功後に確認済みユーザーへロールとユーザーを投入する', async () => {
    const events = [];
    const prompt = createPrompt(['y']);
    await runTest({
        argv: ['--only', 'standard-objects-accounts'],
        targetOrg: 'test-org',
        createPrompt: () => prompt.prompt,
        runSfCommand: createRunSfCommand(() => {
            events.push('standard');
            return { status: 0, stdout: '', stderr: '' };
        }, 'scratch'),
        async runOrgExplorerSeedCommand(options) {
            events.push('org-explorer');
            assert.equal(options.targetOrg, 'user@example.com');
            assert.deepEqual(options.argv, []);
            assert.equal(typeof options.createPrompt, 'function');
            return 0;
        }
    });
    assert.deepEqual(events, ['standard', 'org-explorer']);
});

for (const type of ['sandbox', 'developer']) {
    test(`${type}ではロールとユーザーの追加投入を行わない`, async () => {
        let seedCount = 0;
        const prompt = createPrompt(['y']);
        await runTest({
            argv: ['--only', 'standard-objects-accounts'],
            targetOrg: 'test-org',
            createPrompt: () => prompt.prompt,
            runSfCommand: createRunSfCommand(() => ({ status: 0, stdout: '', stderr: '' }), type),
            async runOrgExplorerSeedCommand() {
                seedCount++;
                return 0;
            }
        });
        assert.equal(seedCount, 0);
    });
}

for (const outcome of ['cancel', 'failure', 'dry-run']) {
    test(`標準データ投入が${outcome}なら追加投入を行わない`, async () => {
        let seedCount = 0;
        const prompt = createPrompt([outcome === 'cancel' ? 'n' : 'y']);
        const operation = () =>
            runTest({
                argv: ['--only', 'standard-objects-accounts', ...(outcome === 'dry-run' ? ['--dry-run'] : [])],
                targetOrg: 'test-org',
                createPrompt: () => prompt.prompt,
                runSfCommand: createRunSfCommand(
                    () => ({ status: outcome === 'failure' ? 1 : 0, stdout: '', stderr: '' }),
                    'scratch'
                ),
                async runOrgExplorerSeedCommand() {
                    seedCount++;
                    return 0;
                }
            });
        if (outcome === 'failure') await assert.rejects(operation, /sfコマンドが失敗/);
        else await operation();
        assert.equal(seedCount, 0);
    });
}

test('追加データ作成の失敗を準備失敗として伝える', async () => {
    const prompt = createPrompt(['y']);
    await assert.rejects(
        () =>
            runTest({
                argv: ['--only', 'standard-objects-accounts'],
                targetOrg: 'test-org',
                createPrompt: () => prompt.prompt,
                runSfCommand: createRunSfCommand(() => ({ status: 0, stdout: '', stderr: '' }), 'scratch'),
                async runOrgExplorerSeedCommand() {
                    return 1;
                }
            }),
        /テスト用ロール・ユーザーデータの作成に失敗/
    );
});

test('通常のsetup:dataにはロールとユーザーの自動投入を追加しない', async () => {
    let seedCount = 0;
    const prompt = createPrompt(['y']);
    await runTest({
        argv: ['--only', 'standard-objects-accounts'],
        createPrompt: () => prompt.prompt,
        runSfCommand: createRunSfCommand(() => ({ status: 0, stdout: '', stderr: '' }), 'scratch'),
        async runOrgExplorerSeedCommand() {
            seedCount++;
            return 0;
        }
    });
    assert.equal(seedCount, 0);
});
