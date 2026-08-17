// 実行コマンド: node --test scripts/scratch-org/test/context.node.js
// 用途: Scratch Orgの共通設定と参照ファイルを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, scratchOrg } = require('../internal/context');

test('リポジトリルートとScratch Org設定の参照先を解決できる', () => {
    // 共通処理が正しいリポジトリルートを返すことを確認する。
    assert.equal(repoRoot, path.resolve(__dirname, '../../..'));

    // Scratch Org設定が参照する各ファイルの存在を確認する。
    for (const configKey of ['definitionFile', 'importPlan', 'manifest']) {
        const targetPath = path.resolve(repoRoot, scratchOrg[configKey]);

        assert.ok(fs.existsSync(targetPath), `${configKey}の参照先がありません: ${targetPath}`);
    }
});
