// 実行コマンド: node --test scripts/metadata/retrieve/test/retrieve-plan.node.js
// 用途: retrieve対象のmanifest、取得順、未知の引数を指定した場合の動作を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { manifests } = require('../retrieve');

// manifestとretrieveスクリプトをリポジトリルート基準で参照する。
const repoRoot = path.resolve(__dirname, '../../../..');

test('retrieve scriptが分割manifestを重複なくすべて含む', () => {
    // retrieve用manifestをディレクトリから取得する。
    const splitManifests = fs
        .readdirSync(path.join(repoRoot, 'manifest'))
        .filter((fileName) => fileName.startsWith('retrieve-') && fileName !== 'retrieve-all.xml')
        .map((fileName) => `manifest/${fileName}`)
        .sort();

    // スクリプトのmanifest一覧に重複がないことを確認する。
    assert.equal(new Set(manifests).size, manifests.length);

    // ディレクトリ内の分割manifestがすべて定義されていることを確認する。
    assert.deepEqual([...manifests].sort(), splitManifests);

    // 定義されたmanifestがすべて存在することを確認する。
    assert.ok(manifests.every((entry) => fs.existsSync(path.join(repoRoot, entry))));
});

test('Profileを最初、Translationsを最後に取得する', () => {
    // 関連メタデータを含めるため、Profileを最初に取得する。
    assert.equal(manifests[0], 'manifest/retrieve-profile.xml');

    // 翻訳内容を欠落させないため、Translationsを最後に取得する。
    assert.equal(manifests.at(-1), 'manifest/retrieve-translations.xml');
});

test('retrieve scriptは未知の引数をSalesforce CLI実行前に拒否する', () => {
    // 未知の引数を指定してretrieveスクリプトを実行する。
    const result = spawnSync(process.execPath, ['scripts/metadata/retrieve/retrieve.js', '--unknown'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    // 組織へ接続せず、異常終了することを確認する。
    assert.equal(result.status, 1);

    // 正しい実行方法がエラー出力に表示されることを確認する。
    assert.match(result.stderr, /Usage: node scripts\/metadata\/retrieve\/retrieve\.js/);
});
