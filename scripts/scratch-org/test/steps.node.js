// 実行コマンド: node --test scripts/scratch-org/test/steps.node.js
// 用途: Scratch Orgの各操作が正しい引数で外部処理を実行することを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { main: deleteScratchOrg } = require('../delete');
const { repoRoot, scratchOrg } = require('../internal/context');
const { main: assignPermissionSet } = require('../steps/assign-permission-set');
const { main: createScratchOrg } = require('../steps/create');
const { main: deployMetadata } = require('../steps/deploy');
const { main: importTestData } = require('../steps/import-test-data');

// Salesforce CLIへ渡された引数と作業場所を記録する。
function captureSfCall(execute) {
    let call;
    const status = execute((args, workingDirectory) => {
        call = { args, workingDirectory };
        return 0;
    });

    assert.equal(status, 0);
    assert.equal(call.workingDirectory, repoRoot);
    return call.args;
}

test('Scratch Orgを設定ファイルの内容で作成する', () => {
    // definition、alias、有効日数がSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        createScratchOrg({
            argv: ['--alias', 'test-scratch-org'],
            runSfCommand,
            stdout: { write() {} }
        })
    );

    assert.deepEqual(args, [
        'org',
        'create',
        'scratch',
        '--definition-file',
        scratchOrg.definitionFile,
        '--alias',
        'test-scratch-org',
        '--duration-days',
        String(scratchOrg.durationDays)
    ]);
});

test('Scratch Orgへ設定ファイルのmanifestを反映する', () => {
    // manifest、alias、待機時間がSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        deployMetadata({ argv: ['--alias', 'test-scratch-org'], runSfCommand })
    );

    assert.deepEqual(args, [
        'project',
        'deploy',
        'start',
        '--manifest',
        scratchOrg.manifest,
        '--target-org',
        'test-scratch-org',
        '--wait',
        String(scratchOrg.waitMinutes)
    ]);
});

test('Scratch Orgへ設定ファイルのPermission Setを割り当てる', () => {
    // Permission SetとaliasがSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        assignPermissionSet({ argv: ['--alias', 'test-scratch-org'], runSfCommand })
    );

    assert.deepEqual(args, [
        'org',
        'assign',
        'permset',
        '--name',
        scratchOrg.permissionSet,
        '--target-org',
        'test-scratch-org'
    ]);
});

test('Scratch Org用の設定でテストデータを投入する', async () => {
    // 共通処理へplan、内部alias、繰り返し回数が渡ることを確認する。
    let options;
    const status = await importTestData({
        argv: ['--alias', 'test-scratch-org'],
        async runImportTestDataCommand(runOptions) {
            options = runOptions;
        }
    });

    assert.equal(status, 0);
    assert.deepEqual(options, {
        argv: ['--plan', scratchOrg.importPlan, '--default-repeat', '40'],
        targetOrg: 'test-scratch-org'
    });
});

test('明示されたaliasのScratch Orgだけを削除する', () => {
    // 削除対象のaliasがSalesforce CLIへ渡ることを確認する。
    const args = captureSfCall((runSfCommand) =>
        deleteScratchOrg({ argv: ['--alias', 'test-scratch-org'], runSfCommand })
    );

    assert.deepEqual(args, ['org', 'delete', 'scratch', '--target-org', 'test-scratch-org']);
});
