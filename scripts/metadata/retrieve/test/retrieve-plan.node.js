const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../../..');
const planPath = path.join(repoRoot, 'scripts/metadata/retrieve/retrieve-plan.txt');

function readPlan() {
    return fs
        .readFileSync(planPath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

test('retrieve planが分割manifestを重複なくすべて含む', () => {
    const planEntries = readPlan();
    const splitManifests = fs
        .readdirSync(path.join(repoRoot, 'manifest'))
        .filter((fileName) => fileName.startsWith('retrieve-') && fileName !== 'retrieve-all.xml')
        .map((fileName) => `manifest/${fileName}`)
        .sort();

    assert.equal(new Set(planEntries).size, planEntries.length);
    assert.deepEqual([...planEntries].sort(), splitManifests);
    assert.ok(planEntries.every((entry) => fs.existsSync(path.join(repoRoot, entry))));
});

test('Profileを最初、Translationsを最後に取得する', () => {
    const planEntries = readPlan();

    assert.equal(planEntries[0], 'manifest/retrieve-profile.xml');
    assert.equal(planEntries.at(-1), 'manifest/retrieve-translations.xml');
});

test('retrieve scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    const result = spawnSync('bash', ['scripts/metadata/retrieve/retrieve.sh', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: bash scripts\/metadata\/retrieve\/retrieve\.sh/);
});
