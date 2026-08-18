// 実行コマンド: node --test scripts/metadata/destructive/test/destructive.node.js
// 用途: destructiveスクリプトが未知の引数を組織接続前に拒否することを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { main } = require('../destructive');

// destructiveスクリプトをリポジトリルート基準で実行する。
const repoRoot = path.resolve(__dirname, '../../../..');

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

test('destructive scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    // 未知の引数を指定してdestructiveスクリプトを実行する。
    const result = spawnSync(process.execPath, ['scripts/metadata/destructive/destructive.js', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    // 組織へ接続せず、異常終了することを確認する。
    assert.equal(result.status, 1);

    // エラー理由と正しい実行コマンドが表示されることを確認する。
    assert.match(result.stderr, /エラー: このスクリプトは引数を受け付けません。/);
    assert.match(result.stderr, /実行コマンド: npm run sf:destructive/);
});

test('dry-runが失敗した場合は実削除を実行しない', async () => {
    // dry-runだけを承認し、2回目のSalesforce CLI実行を失敗させる。
    const commandArgs = [];
    const prompt = createPrompt(['y']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return commandArgs.length === 2 ? 1 : 0;
        }
    });

    // dry-run以降の実削除が呼ばれず、確認入力が閉じられることを確認する。
    assert.equal(status, 1);
    assert.deepEqual(commandArgs[0], ['config', 'get', 'target-org']);
    assert.deepEqual(commandArgs[1].slice(-1), ['--dry-run']);
    assert.equal(commandArgs.length, 2);
    assert.equal(prompt.isClosed(), true);
});

test('Default Target Orgを確認できない場合は入力確認を開始しない', async () => {
    // 組織設定の確認を失敗させ、入力処理の作成回数を記録する。
    let promptCount = 0;
    const status = await main({
        argv: [],
        createPrompt() {
            promptCount += 1;
        },
        runSfCommand() {
            return 1;
        }
    });

    // 組織が確定していない状態ではdry-runの確認を表示しない。
    assert.equal(status, 1);
    assert.equal(promptCount, 0);
});

test('dry-runが承認されない場合は削除処理を実行しない', async () => {
    // dry-runを承認せず、Salesforce CLIの実行内容を記録する。
    const commandArgs = [];
    const prompt = createPrompt(['n']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        }
    });

    // Default Target Orgの表示だけで正常終了することを確認する。
    assert.equal(status, 0);
    assert.deepEqual(commandArgs, [['config', 'get', 'target-org']]);
    assert.equal(prompt.isClosed(), true);
});

test('dry-run成功後に削除が承認されない場合は実削除しない', async () => {
    // dry-runだけを承認し、Salesforce CLIの実行内容を記録する。
    const commandArgs = [];
    const prompt = createPrompt(['y', 'n']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        }
    });

    // 設定確認とdry-runだけで正常終了することを確認する。
    assert.equal(status, 0);
    assert.equal(commandArgs.length, 2);
    assert.equal(commandArgs[1].at(-1), '--dry-run');
    assert.equal(prompt.isClosed(), true);
});

test('dry-run成功後に再承認された場合だけ同じmanifest構成で実削除する', async () => {
    // dry-runと実削除の両方を承認し、実行された引数を記録する。
    const commandArgs = [];
    const prompt = createPrompt(['y', 'y']);
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        }
    });

    // Salesforce CLIへ渡すdestructive deployの共通引数を定義する。
    const deployArgs = [
        'project',
        'deploy',
        'start',
        '--manifest',
        'manifest/destructiveChanges.xml',
        '--post-destructive-changes',
        'manifest/destructiveChanges.xml',
        '--wait',
        '30'
    ];

    // dry-runを外した同じ引数で実削除し、確認入力が閉じられることを確認する。
    assert.equal(status, 0);
    assert.equal(commandArgs.length, 3);
    assert.deepEqual(commandArgs[1], [...deployArgs, '--dry-run']);
    assert.deepEqual(commandArgs[2], deployArgs);
    assert.equal(prompt.isClosed(), true);
});
