// 実行コマンド: node --test scripts/test/run-command.node.js
// 用途: Salesforce CLIとNode.js子スクリプトのOS別実行方法を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSfCommand, runNodeScript, runSfWithOutput } = require('../internal/run-command');

// 外部処理をリポジトリルートで実行する。
const repoRoot = path.resolve(__dirname, '../..');

test('macOSではSalesforce CLIを直接実行する', () => {
    // macOS向けのSalesforce CLI引数を準備する。
    const args = ['config', 'get', 'target-org'];

    // shellを経由せず、sfへ引数をそのまま渡すことを確認する。
    assert.deepEqual(buildSfCommand(args, 'darwin'), {
        command: 'sf',
        args
    });
});

test('WindowsではSalesforce CLIだけをcmd.exe経由で実行する', () => {
    // Windowsではsf.cmdを実行できるよう、cmd.exeだけを前置する。
    assert.deepEqual(buildSfCommand(['config', 'get', 'target-org'], 'win32'), {
        command: 'cmd.exe',
        args: ['/d', '/c', 'sf', 'config', 'get', 'target-org']
    });
});

test('Windowsでcmd.exeが解釈する文字をSalesforce CLIへ渡さない', () => {
    // 別コマンドや環境変数として解釈される代表的な引数を検証する。
    for (const unsafeArgument of ['alias&next', 'alias|next', 'alias%PATH%', 'alias\nnext']) {
        // 危険な引数はcmd.exeを起動する前に拒否する。
        assert.throws(
            () => buildSfCommand(['--target-org', unsafeArgument], 'win32'),
            /Windowsで使用できない文字が引数に含まれています/
        );
    }
});

test('Node.js子スクリプトの終了コードを返す', () => {
    // 現在のNode.jsから終了コード7の子プロセスを実行する。
    const status = runNodeScript('-e', ['process.exit(7)'], repoRoot);

    // 子プロセスの終了コードが維持されることを確認する。
    assert.equal(status, 7);
});

test('WindowsでSalesforce CLIの出力を取得する', { skip: process.platform !== 'win32' }, () => {
    // Windowsへ導入したSalesforce CLIを実際に起動する。
    const result = runSfWithOutput(['--version'], repoRoot);

    // 終了コードと取得したバージョン出力を確認する。
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /@salesforce\/cli/);
});
