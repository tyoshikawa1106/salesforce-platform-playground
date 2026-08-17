// 実行コマンド: node --test scripts/metadata/destructive/test/destructive.node.js
// 用途: destructiveスクリプトが未知の引数を組織接続前に拒否することを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// destructiveスクリプトをリポジトリルート基準で実行する。
const repoRoot = path.resolve(__dirname, '../../../..');

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
