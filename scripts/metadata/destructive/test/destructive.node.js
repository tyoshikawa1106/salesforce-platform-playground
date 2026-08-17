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

test('dry-run成功後に再承認された場合だけ同じmanifestで実削除する', async () => {
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

    // dry-runを外した同じ引数で実削除し、確認入力が閉じられることを確認する。
    assert.equal(status, 0);
    assert.equal(commandArgs.length, 3);
    assert.deepEqual(commandArgs[1].slice(0, -1), commandArgs[2]);
    assert.equal(commandArgs[1].at(-1), '--dry-run');
    assert.ok(commandArgs[2].includes('manifest/destructiveChanges.xml'));
    assert.equal(prompt.isClosed(), true);
});
