// 実行コマンド: node --test scripts/scratch-org/test/manifest.node.js
// 用途: Scratch Org再構築manifestに自作ソースがすべて含まれることを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot, scratchOrg } = require('../internal/context');

// Scratch Org再構築manifestを読み込む。
const manifest = fs.readFileSync(path.join(repoRoot, scratchOrg.manifest), 'utf8');

// manifestから指定したメタデータ種別のmembersを取得する。
function getManifestMembers(typeName) {
    const typeBlocks = manifest.matchAll(/<types>([\s\S]*?)<\/types>/g);

    for (const [, typeBlock] of typeBlocks) {
        if (typeBlock.includes(`<name>${typeName}</name>`)) {
            return [...typeBlock.matchAll(/<members>([^<]+)<\/members>/g)].map((match) => match[1]);
        }
    }

    return [];
}

// 指定した拡張子のソース名をディレクトリから取得する。
function getSourceNames(directory, extension) {
    return fs
        .readdirSync(path.join(repoRoot, directory))
        .filter((fileName) => fileName.endsWith(extension))
        .map((fileName) => fileName.slice(0, -extension.length))
        .sort();
}

// LWCのメタデータファイルがあるバンドル名を取得する。
function getLightningComponentBundleNames(directory) {
    const sourceDirectory = path.join(repoRoot, directory);

    return fs
        .readdirSync(sourceDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => fs.existsSync(path.join(sourceDirectory, entry.name, `${entry.name}.js-meta.xml`)))
        .map((entry) => entry.name)
        .sort();
}

// ファイル単位で管理する自作ソースの対象を定義する。
const fileMetadataTypes = [
    ['ApexClass', 'force-app/main/default/classes', '.cls'],
    ['ApexPage', 'force-app/main/default/pages', '.page'],
    ['ApexTrigger', 'force-app/main/default/triggers', '.trigger'],
    ['QuickAction', 'force-app/main/default/quickActions', '.quickAction-meta.xml']
];

for (const [typeName, directory, extension] of fileMetadataTypes) {
    test(`${typeName}の全ソースが再構築manifestに含まれる`, () => {
        // リポジトリとmanifestの対象名を比較する。
        const sourceNames = getSourceNames(directory, extension);
        const manifestMembers = getManifestMembers(typeName);

        assert.deepEqual(
            sourceNames.filter((name) => !manifestMembers.includes(name)),
            []
        );
    });
}

test('LightningComponentBundleの全ソースが再構築manifestに含まれる', () => {
    // メタデータファイルを持つLWCバンドルだけを比較する。
    const sourceNames = getLightningComponentBundleNames('force-app/main/default/lwc');
    const manifestMembers = getManifestMembers('LightningComponentBundle');

    assert.deepEqual(
        sourceNames.filter((name) => !manifestMembers.includes(name)),
        []
    );
});
