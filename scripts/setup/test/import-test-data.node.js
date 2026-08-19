// 実行コマンド: node --test scripts/setup/test/import-test-data.node.js
// 用途: テストデータ投入入口のdry-run、組織制御、失敗時の後始末を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { run } = require('../import-test-data');

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

    await run({
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
        () => run({ argv: ['--target-org', 'test-org', '--only', 'standard-objects-accounts'] }),
        /未対応の引数が指定されました: --target-org/
    );
});

test('Default Target Orgが未設定の場合は入力確認を開始しない', async () => {
    let promptCount = 0;

    await assert.rejects(
        () =>
            run({
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

    await run({
        argv: ['--only', 'standard-objects-accounts'],
        createPrompt: () => prompt.prompt,
        runSfCommand: createRunSfCommand(() => {
            apexExecutionCount += 1;
        })
    });

    assert.equal(apexExecutionCount, 0);
    assert.equal(prompt.isClosed(), true);
});

test('本番環境は接続組織が承認されても実投入しない', async () => {
    let apexExecutionCount = 0;
    const prompt = createPrompt(['y']);

    await assert.rejects(
        () =>
            run({
                argv: ['--only', 'standard-objects-accounts'],
                createPrompt: () => prompt.prompt,
                runSfCommand: createRunSfCommand(() => {
                    apexExecutionCount += 1;
                }, 'production')
            }),
        /本番環境へのテストデータ投入は許可されていません/
    );

    assert.equal(apexExecutionCount, 0);
    assert.equal(prompt.isClosed(), true);
});

for (const type of ['sandbox', 'scratch', 'developer']) {
    test(`${type}では接続組織の承認後に実投入する`, async () => {
        let apexExecutionCount = 0;
        const prompt = createPrompt(['y']);

        await run({
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

    await run({
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

test('Salesforce CLI失敗時は一時Apexファイルを削除して終了する', async () => {
    let generatedFilePath;
    const prompt = createPrompt(['y']);

    await assert.rejects(
        () =>
            run({
                argv: ['--only', 'standard-objects-accounts'],
                createPrompt: () => prompt.prompt,
                runSfCommand: createRunSfCommand((args) => {
                    generatedFilePath = args[args.indexOf('--file') + 1];
                    assert.equal(fs.existsSync(generatedFilePath), true);
                    return { status: 1, stdout: '', stderr: '' };
                })
            }),
        /sfコマンドが失敗しました（standard-objects-accounts）/
    );

    assert.equal(fs.existsSync(generatedFilePath), false);
});

test('Salesforce CLIを開始できない場合も一時Apexファイルを削除する', async () => {
    let generatedFilePath;
    const prompt = createPrompt(['y']);

    await assert.rejects(
        () =>
            run({
                argv: ['--only', 'standard-objects-accounts'],
                createPrompt: () => prompt.prompt,
                runSfCommand: createRunSfCommand((args) => {
                    generatedFilePath = args[args.indexOf('--file') + 1];
                    return { error: new Error('起動失敗'), status: null, stdout: '', stderr: '' };
                })
            }),
        /sfコマンドを開始できませんでした（standard-objects-accounts）: 起動失敗/
    );

    assert.equal(fs.existsSync(generatedFilePath), false);
});

test('Salesforce CLI成功時も一時Apexファイルを削除する', async () => {
    let generatedFilePath;
    const prompt = createPrompt(['y']);

    await run({
        argv: ['--only', 'standard-objects-accounts'],
        createPrompt: () => prompt.prompt,
        runSfCommand: createRunSfCommand((args) => {
            generatedFilePath = args[args.indexOf('--file') + 1];
            assert.equal(fs.existsSync(generatedFilePath), true);
            return { status: 0, stdout: '', stderr: '' };
        })
    });

    assert.equal(fs.existsSync(generatedFilePath), false);
});
