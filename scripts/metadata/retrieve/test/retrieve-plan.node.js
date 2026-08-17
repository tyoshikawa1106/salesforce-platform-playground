const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { manifests } = require('../retrieve');

const repoRoot = path.resolve(__dirname, '../../../..');

test('retrieve scriptが分割manifestを重複なくすべて含む', () => {
    const splitManifests = fs
        .readdirSync(path.join(repoRoot, 'manifest'))
        .filter((fileName) => fileName.startsWith('retrieve-') && fileName !== 'retrieve-all.xml')
        .map((fileName) => `manifest/${fileName}`)
        .sort();

    assert.equal(new Set(manifests).size, manifests.length);
    assert.deepEqual([...manifests].sort(), splitManifests);
    assert.ok(manifests.every((entry) => fs.existsSync(path.join(repoRoot, entry))));
});

test('Profileを最初、Translationsを最後に取得する', () => {
    assert.equal(manifests[0], 'manifest/retrieve-profile.xml');
    assert.equal(manifests.at(-1), 'manifest/retrieve-translations.xml');
});

test('retrieve scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    const result = spawnSync(process.execPath, ['scripts/metadata/retrieve/retrieve.js', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: node scripts\/metadata\/retrieve\/retrieve\.js/);
});
