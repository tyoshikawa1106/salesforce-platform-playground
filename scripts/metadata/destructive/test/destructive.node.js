// 実行コマンド: node --test scripts/metadata/destructive/test/destructive.node.js
// 用途: destructiveスクリプトの接続先確認、組織制御、dry-run、実削除を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { main } = require('../destructive');

// destructiveスクリプトをリポジトリルート基準で実行する。
const repoRoot = path.resolve(__dirname, '../../../..');

// 確認への回答と質問を順番に記録し、最後にcloseされたことを確認できるようにする。
function createPrompt(answers) {
    let closed = false;
    const questions = [];

    return {
        prompt: {
            async question(message) {
                questions.push(message);
                return answers.shift();
            },
            close() {
                closed = true;
            }
        },
        getQuestions() {
            return questions;
        },
        isClosed() {
            return closed;
        }
    };
}

// Salesforce CLIのJSON成功結果を子プロセスの戻り値形式で作成する。
function createSfResult(result) {
    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ status: 0, result })
    };
}

// Default Target Orgと指定種別の認証済み組織一覧を返す処理を作成する。
function createOrgInfoCommand(type = 'sandbox') {
    return (args) => {
        if (args[0] === 'config') {
            return createSfResult([{ name: 'target-org', success: true, value: 'test-org' }]);
        }

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

        return createSfResult({ nonScratchOrgs, sandboxes, scratchOrgs });
    };
}

test('destructive scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    const result = spawnSync(process.execPath, ['scripts/metadata/destructive/destructive.js', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /エラー: このスクリプトは引数を受け付けません。/);
    assert.match(result.stderr, /実行コマンド: npm run sf:destructive/);
});

test('Default Target Orgを確認できない場合は入力確認を開始しない', async () => {
    let promptCount = 0;

    await assert.rejects(
        () =>
            main({
                argv: [],
                createPrompt() {
                    promptCount += 1;
                },
                runSfWithOutputCommand() {
                    return createSfResult([{ name: 'target-org', success: true }]);
                }
            }),
        /Default Target Orgが設定されていません/
    );

    assert.equal(promptCount, 0);
});

test('接続組織が承認されない場合はdry-runを実行しない', async () => {
    const commandArgs = [];
    const prompt = createPrompt(['n']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        },
        runSfWithOutputCommand: createOrgInfoCommand()
    });

    assert.equal(status, 0);
    assert.equal(commandArgs.length, 0);
    assert.deepEqual(prompt.getQuestions(), ['この接続組織で続行しますか？ [y/N]: ']);
    assert.equal(prompt.isClosed(), true);
});

for (const [type, label] of [
    ['production', '本番環境'],
    ['developer', 'Developer Edition']
]) {
    test(`${label}の追加確認が承認されない場合はdry-runを実行しない`, async () => {
        const commandArgs = [];
        const prompt = createPrompt(['y', 'n']);
        const status = await main({
            argv: [],
            createPrompt: () => prompt.prompt,
            runSfCommand(args) {
                commandArgs.push(args);
                return 0;
            },
            runSfWithOutputCommand: createOrgInfoCommand(type)
        });

        assert.equal(status, 0);
        assert.equal(commandArgs.length, 0);
        assert.deepEqual(prompt.getQuestions(), [
            'この接続組織で続行しますか？ [y/N]: ',
            `${label}です。メタデータ削除を実行してよろしいですか？ [y/N]: `
        ]);
        assert.equal(prompt.isClosed(), true);
    });
}

test('Sandboxでは環境別の追加確認なしでdry-runを実行する', async () => {
    const commandArgs = [];
    const prompt = createPrompt(['y', 'n']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        },
        runSfWithOutputCommand: createOrgInfoCommand('sandbox')
    });

    assert.equal(status, 0);
    assert.equal(commandArgs.length, 1);
    assert.equal(commandArgs[0].at(-1), '--dry-run');
    assert.deepEqual(prompt.getQuestions(), [
        'この接続組織で続行しますか？ [y/N]: ',
        'dry-runが成功しました。実際にメタデータを削除しますか？ [y/N]: '
    ]);
});

test('dry-runが失敗した場合は実削除を実行しない', async () => {
    const commandArgs = [];
    const prompt = createPrompt(['y']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 1;
        },
        runSfWithOutputCommand: createOrgInfoCommand('sandbox')
    });

    assert.equal(status, 1);
    assert.equal(commandArgs.length, 1);
    assert.equal(commandArgs[0].at(-1), '--dry-run');
    assert.equal(prompt.isClosed(), true);
});

test('dry-run成功後に削除が承認されない場合は実削除しない', async () => {
    const commandArgs = [];
    const prompt = createPrompt(['y', 'n']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        },
        runSfWithOutputCommand: createOrgInfoCommand('scratch')
    });

    assert.equal(status, 0);
    assert.equal(commandArgs.length, 1);
    assert.equal(commandArgs[0].at(-1), '--dry-run');
    assert.equal(prompt.isClosed(), true);
});

test('本番環境の全確認が承認された場合だけ同じ対象へ実削除する', async () => {
    const commandArgs = [];
    const prompt = createPrompt(['y', 'y', 'y']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        },
        runSfWithOutputCommand: createOrgInfoCommand('production')
    });
    const deployArgs = [
        'project',
        'deploy',
        'start',
        '--manifest',
        'manifest/destructiveChanges.xml',
        '--post-destructive-changes',
        'manifest/destructiveChanges.xml',
        '--target-org',
        'test-org',
        '--wait',
        '30'
    ];

    assert.equal(status, 0);
    assert.deepEqual(commandArgs, [[...deployArgs, '--dry-run'], deployArgs]);
    assert.equal(prompt.isClosed(), true);
});
