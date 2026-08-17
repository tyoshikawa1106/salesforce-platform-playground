const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runCommand, runCommandWithOutput } = require('../run-command');

const repoRoot = path.resolve(__dirname, '../..');

test('外部CLIの終了コードを呼び出し元へ返す', () => {
    const status = runCommand(process.execPath, ['-e', 'process.exit(7)'], repoRoot);

    assert.equal(status, 7);
});

test('外部CLIの標準出力を文字列として受け取る', () => {
    const result = runCommandWithOutput(process.execPath, ['-e', "process.stdout.write('captured')"], repoRoot);

    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'captured');
});
