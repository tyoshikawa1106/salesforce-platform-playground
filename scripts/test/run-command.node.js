// 実行コマンド: node --test scripts/test/run-command.node.js
// 用途: 外部CLIの終了コードと標準出力を呼び出し元へ返せることを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runCommand, runCommandWithOutput } = require('../run-command');

// 外部CLIをリポジトリルートで実行する。
const repoRoot = path.resolve(__dirname, '../..');

test('外部CLIの終了コードを呼び出し元へ返す', () => {
    // 終了コード7を返すNode.jsプロセスを実行する。
    const status = runCommand(process.execPath, ['-e', 'process.exit(7)'], repoRoot);

    // 子プロセスの終了コードが維持されることを確認する。
    assert.equal(status, 7);
});

test('外部CLIの標準出力を文字列として受け取る', () => {
    // 標準出力へ文字列を書き込むNode.jsプロセスを実行する。
    const result = runCommandWithOutput(process.execPath, ['-e', "process.stdout.write('captured')"], repoRoot);

    // 正常終了し、出力内容を取得できることを確認する。
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'captured');
});
