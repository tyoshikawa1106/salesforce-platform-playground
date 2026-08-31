// 実行コマンド: node --test scripts/metadata/destructive/test/destructive.node.js
// 用途: destructiveスクリプトの接続先確認、組織制御、dry-run、実削除を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { main, validateDestructiveManifest } = require('../destructive');
const { deployOperations } = require('../internal/deploy-runner');

// destructiveスクリプトをリポジトリルート基準で実行する。
const repoRoot = path.resolve(__dirname, '../../../..');

test('destructive deploy用の通常manifestは追加・更新対象を持たずAPIバージョンを揃える', () => {
    const manifest = fs.readFileSync(path.join(repoRoot, 'manifest/destructivePackage.xml'), 'utf8');
    const project = JSON.parse(fs.readFileSync(path.join(repoRoot, 'sfdx-project.json'), 'utf8'));
    const apiVersion = manifest.match(/<version>([^<]+)<\/version>/)?.[1];

    assert.doesNotMatch(manifest, /<types>/);
    assert.equal(apiVersion, project.sourceApiVersion);
});

test('削除対象manifestは通常時にプレースホルダーと削除対象を残さずAPIバージョンを揃える', () => {
    const manifest = fs.readFileSync(path.join(repoRoot, 'manifest/destructiveChanges.xml'), 'utf8');
    const project = JSON.parse(fs.readFileSync(path.join(repoRoot, 'sfdx-project.json'), 'utf8'));
    const apiVersion = manifest.match(/<version>([^<]+)<\/version>/)?.[1];

    assert.doesNotMatch(manifest, /REPLACE_WITH_/);
    assert.doesNotMatch(manifest, /<types>/);
    assert.equal(apiVersion, project.sourceApiVersion);
});

test('削除対象manifestにプレースホルダーが残る場合は拒否する', () => {
    assert.throws(
        () =>
            validateDestructiveManifest({
                readFileSync() {
                    return '<Package><types><members>REPLACE_WITH_APEX_CLASS_NAME</members></types></Package>';
                }
            }),
        /プレースホルダーが残っています/
    );
});

test('削除対象manifestに削除対象がない場合は拒否する', () => {
    assert.throws(
        () =>
            validateDestructiveManifest({
                readFileSync() {
                    return '<Package><version>67.0</version></Package>';
                }
            }),
        /削除対象が設定されていません/
    );
});

test('削除対象manifestにmetadata名がある場合は許可する', () => {
    assert.doesNotThrow(() =>
        validateDestructiveManifest({
            readFileSync() {
                return '<Package><types><members>UnusedClass</members><name>ApexClass</name></types></Package>';
            }
        })
    );
});

test('削除対象manifestの複数typeとmembersを許可する', () => {
    assert.doesNotThrow(() =>
        validateDestructiveManifest({
            readFileSync() {
                return (
                    '<Package><types><members>OldClass</members><name>ApexClass</name></types>' +
                    '<types><members>Account.OldField__c</members><members>Contact.OldField__c</members>' +
                    '<name>CustomField</name></types></Package>'
                );
            }
        })
    );
});

test('削除範囲を個別指定できないワイルドカードは拒否する', () => {
    assert.throws(
        () =>
            validateDestructiveManifest({
                readFileSync() {
                    return '<Package><types><members>*</members><name>ApexClass</name></types></Package>';
                }
            }),
        /ワイルドカードは使用できません/
    );
});

test('削除対象が未設定の場合はSalesforce CLI実行前に停止する', async () => {
    let commandCount = 0;

    await assert.rejects(
        () =>
            main({
                argv: [],
                runSfWithOutputCommand() {
                    commandCount += 1;
                }
            }),
        /削除対象が設定されていません/
    );

    assert.equal(commandCount, 0);
});

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

// dry-runと実削除の監視呼び出しを記録し、指定した終了コードを順番に返す。
function createDeployCommand(statuses = [0]) {
    const calls = [];

    return {
        calls,
        async command(options) {
            calls.push(options);
            return statuses.shift() ?? 0;
        }
    };
}

test('destructive scriptは引数をSalesforce CLI実行前に拒否する', () => {
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
                validateManifest() {},
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
    const deploy = createDeployCommand();
    const prompt = createPrompt(['n']);
    const status = await main({
        argv: [],
        validateManifest() {},
        createPrompt: () => prompt.prompt,
        runDeployCommand: deploy.command,
        runSfWithOutputCommand: createOrgInfoCommand()
    });

    assert.equal(status, 0);
    assert.equal(deploy.calls.length, 0);
    assert.deepEqual(prompt.getQuestions(), ['この接続組織で続行しますか？ [y/N]: ']);
    assert.equal(prompt.isClosed(), true);
});

for (const [type, label] of [
    ['developer', 'Developer Edition'],
    ['production', '本番環境']
]) {
    test(`${label}の追加確認が承認されない場合はdry-runを実行しない`, async () => {
        const deploy = createDeployCommand();
        const prompt = createPrompt(['y', 'n']);
        const status = await main({
            argv: [],
            validateManifest() {},
            createPrompt: () => prompt.prompt,
            runDeployCommand: deploy.command,
            runSfWithOutputCommand: createOrgInfoCommand(type)
        });

        assert.equal(status, 0);
        assert.equal(deploy.calls.length, 0);
        assert.deepEqual(prompt.getQuestions(), [
            'この接続組織で続行しますか？ [y/N]: ',
            `${label}です。メタデータ削除を実行してよろしいですか？ [y/N]: `
        ]);
        assert.equal(prompt.isClosed(), true);
    });
}

test('Sandboxでは環境別の追加確認なしでdry-run後に実削除する', async () => {
    const deploy = createDeployCommand([0, 0]);
    const prompt = createPrompt(['y']);
    const status = await main({
        argv: [],
        validateManifest() {
            return [{ type: 'ApexClass', fullName: 'OldClass' }];
        },
        createPrompt: () => prompt.prompt,
        runDeployCommand: deploy.command,
        runSfWithOutputCommand: createOrgInfoCommand('sandbox')
    });

    assert.equal(status, 0);
    assert.equal(deploy.calls.length, 2);
    assert.equal(deploy.calls[0].operation, deployOperations.DRY_RUN);
    assert.equal(deploy.calls[1].operation, deployOperations.DEPLOY);
    assert.deepEqual(prompt.getQuestions(), ['この接続組織で続行しますか？ [y/N]: ']);
});

test('dry-runが失敗した場合は実削除を実行しない', async () => {
    const deploy = createDeployCommand([1]);
    const prompt = createPrompt(['y']);
    const lines = [];
    const status = await main({
        argv: [],
        validateManifest() {
            return [{ type: 'ApexClass', fullName: 'OldClass' }];
        },
        createPrompt: () => prompt.prompt,
        runDeployCommand: deploy.command,
        runSfWithOutputCommand: createOrgInfoCommand('sandbox'),
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.equal(deploy.calls.length, 1);
    assert.equal(deploy.calls[0].operation, deployOperations.DRY_RUN);
    assert.deepEqual(lines, ['dry-runによるメタデータ削除の検証を開始します。']);
    assert.equal(prompt.isClosed(), true);
});

test('本番環境では1回の実行でdry-run後に実削除し、Apexテストを案内する', async () => {
    const deploy = createDeployCommand([0, 0]);
    const prompt = createPrompt(['y', 'y']);
    const lines = [];
    const status = await main({
        argv: [],
        validateManifest() {
            return [{ type: 'ApexClass', fullName: 'OldClass' }];
        },
        createPrompt: () => prompt.prompt,
        runDeployCommand: deploy.command,
        runSfWithOutputCommand: createOrgInfoCommand('production'),
        writeLine(message) {
            lines.push(message);
        }
    });
    const deployArgs = [
        'project',
        'deploy',
        'start',
        '--manifest',
        'manifest/destructivePackage.xml',
        '--post-destructive-changes',
        'manifest/destructiveChanges.xml',
        '--target-org',
        'test-org'
    ];

    assert.equal(status, 0);
    assert.equal(deploy.calls.length, 2);
    assert.deepEqual(deploy.calls[0].deployArgs, deployArgs);
    assert.deepEqual(deploy.calls[1].deployArgs, deployArgs);
    assert.equal(deploy.calls[0].operation, deployOperations.DRY_RUN);
    assert.equal(deploy.calls[1].operation, deployOperations.DEPLOY);
    assert.equal(deployArgs.includes('--test-level'), false);
    assert.deepEqual(prompt.getQuestions(), [
        'この接続組織で続行しますか？ [y/N]: ',
        '本番環境です。メタデータ削除を実行してよろしいですか？ [y/N]: '
    ]);
    assert.deepEqual(lines, [
        'dry-runによるメタデータ削除の検証を開始します。',
        'dry-runによるメタデータ削除の検証が成功しました。',
        'メタデータの実削除を開始します。',
        'メタデータの削除が完了しました。',
        '削除後の確認としてApexテストの実行を推奨します: npm run sf:test:apex'
    ]);
    assert.equal(prompt.isClosed(), true);
});

test('実削除が失敗した場合はApexテストを案内しない', async () => {
    const deploy = createDeployCommand([0, 1]);
    const prompt = createPrompt(['y']);
    const lines = [];
    const status = await main({
        argv: [],
        validateManifest() {
            return [{ type: 'ApexClass', fullName: 'OldClass' }];
        },
        createPrompt: () => prompt.prompt,
        runDeployCommand: deploy.command,
        runSfWithOutputCommand: createOrgInfoCommand('sandbox'),
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 1);
    assert.equal(deploy.calls.length, 2);
    assert.equal(deploy.calls[0].operation, deployOperations.DRY_RUN);
    assert.equal(deploy.calls[1].operation, deployOperations.DEPLOY);
    assert.equal(deploy.calls[1].deployArgs.includes('--test-level'), false);
    assert.deepEqual(lines, [
        'dry-runによるメタデータ削除の検証を開始します。',
        'dry-runによるメタデータ削除の検証が成功しました。',
        'メタデータの実削除を開始します。'
    ]);
    assert.equal(prompt.isClosed(), true);
});
