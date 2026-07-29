const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, scratchOrg } = require('../internal-context');

test('リポジトリルートとScratch Org設定の参照先を解決できる', () => {
    assert.equal(repoRoot, path.resolve(__dirname, '../../..'));

    for (const configKey of ['definitionFile', 'importPlan', 'manifest']) {
        const targetPath = path.resolve(repoRoot, scratchOrg[configKey]);

        assert.ok(fs.existsSync(targetPath), `${configKey}の参照先がありません: ${targetPath}`);
    }
});
