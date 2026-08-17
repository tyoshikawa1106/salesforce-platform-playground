const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../../..');

test('destructive scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    const result = spawnSync(process.execPath, ['scripts/metadata/destructive/destructive.js', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: node scripts\/metadata\/destructive\/destructive\.js/);
});
