// 実行コマンド: node --test scripts/metadata/retrieve/test/retrieve.node.js
// 用途: retrieve対象のmanifest、取得順、未知の引数を指定した場合の動作を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { main, manifests } = require('../retrieve');

// manifestとretrieveスクリプトをリポジトリルート基準で参照する。
const repoRoot = path.resolve(__dirname, '../../../..');

// retrieve開始確認へ指定した回答を返す。
function createPrompt(answer) {
    let closed = false;

    return {
        prompt: {
            async question() {
                return answer;
            },
            close() {
                closed = true;
            }
        },
        isClosed() {
            return closed;
        }
    };
}

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

    // エラー理由と正しい実行コマンドが表示されることを確認する。
    assert.match(result.stderr, /エラー: このスクリプトは引数を受け付けません。/);
    assert.match(result.stderr, /実行コマンド: npm run sf:retrieve/);
});

test('取得が承認されない場合はSalesforce CLIの設定確認だけを実行する', async () => {
    // retrieveを承認せず、実行されたSalesforce CLI引数を記録する。
    const commandArgs = [];
    const prompt = createPrompt('n');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        }
    });

    // Default Target Orgの表示後に終了し、確認入力が閉じられることを確認する。
    assert.equal(status, 0);
    assert.deepEqual(commandArgs, [['config', 'get', 'target-org']]);
    assert.equal(prompt.isClosed(), true);
});

test('Default Target Orgを確認できない場合は入力確認を開始しない', async () => {
    // 組織設定の確認を失敗させ、入力処理の作成回数を記録する。
    let promptCount = 0;
    const status = await main({
        argv: [],
        createPrompt() {
            promptCount += 1;
        },
        runSfCommand() {
            return 1;
        }
    });

    // 組織が確定していない状態ではretrieveの確認を表示しない。
    assert.equal(status, 1);
    assert.equal(promptCount, 0);
});

test('承認された場合はすべてのmanifestを定義順に取得する', async () => {
    // retrieveを承認し、実行されたSalesforce CLI引数を記録する。
    const commandArgs = [];
    const prompt = createPrompt('y');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return 0;
        }
    });

    // 設定確認後、すべてのmanifestが定義順に取得されることを確認する。
    assert.equal(status, 0);
    assert.deepEqual(
        commandArgs.slice(1),
        manifests.map((manifest) => ['project', 'retrieve', 'start', '--manifest', manifest])
    );
    assert.equal(prompt.isClosed(), true);
});

test('manifestの定義順に取得し、失敗した時点で後続を実行しない', async () => {
    // retrieveを承認し、2つ目のmanifest取得を失敗させる。
    const commandArgs = [];
    const prompt = createPrompt('y');
    const status = await main({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfCommand(args) {
            commandArgs.push(args);
            return commandArgs.length === 3 ? 1 : 0;
        }
    });

    // 定義順に2件だけ取得し、後続を実行せず確認入力を閉じることを確認する。
    assert.equal(status, 1);
    assert.deepEqual(commandArgs[1], ['project', 'retrieve', 'start', '--manifest', manifests[0]]);
    assert.deepEqual(commandArgs[2], ['project', 'retrieve', 'start', '--manifest', manifests[1]]);
    assert.equal(commandArgs.length, 3);
    assert.equal(prompt.isClosed(), true);
});
