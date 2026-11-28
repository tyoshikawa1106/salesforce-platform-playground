// 実行コマンド: node --test scripts/setup/test/import-test-data-core.node.js
// 用途: テストデータ投入の引数、パス、plan、Apexソース構成を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs, prepareEntries, readPlan, resolveInsideRepo } = require('../internal/import-test-data-core');

// 実際のimport planとApexファイルをリポジトリルート基準で参照する。
const repoRoot = path.resolve(__dirname, '../../..');

test('CLI引数を型付きの設定へ変換する', () => {
    // すべての主要オプションを指定した解析結果を確認する。
    assert.deepEqual(parseArgs(['--dry-run', '--only', 'contacts', '--repeat', '2']), {
        defaultRepeat: null,
        dryRun: true,
        help: false,
        only: 'contacts',
        plan: 'scripts/setup/plans/import-test-data-plan.json',
        repeat: 2
    });
});

test('値が必要なCLIオプションを値なしで指定できない', () => {
    // 値なし、または次のオプションを値として扱わないことを確認する。
    assert.throws(() => parseArgs(['--plan']), /--planには値が必要です/);
    assert.throws(() => parseArgs(['--plan', '--dry-run']), /--planには値が必要です/);
});

test('Target OrgのCLI指定を拒否する', () => {
    assert.throws(() => parseArgs(['--target-org', 'test-org']), /未対応の引数が指定されました: --target-org/);
    assert.throws(() => parseArgs(['-o', 'test-org']), /未対応の引数が指定されました: -o/);
});

test('リポジトリ外のパスを拒否する', () => {
    // 親ディレクトリへ移動する相対パスが拒否されることを確認する。
    assert.throws(() => resolveInsideRepo(repoRoot, '../outside.apex'), /リポジトリ内のパスを指定してください/);
});

test('共通preambleと個別ソースを空行で区切り、周囲の空白を除いて合成する', () => {
    const sources = new Map([
        [path.join(repoRoot, 'preamble.apexpart'), '  Integer count = 1;\n'],
        [path.join(repoRoot, 'entry.apexpart'), '\ncount += 1;  ']
    ]);
    const [prepared] = prepareEntries({
        args: { defaultRepeat: null, only: 'sample', repeat: null },
        fileSystem: {
            existsSync: (file) => sources.has(file),
            readFileSync: (file) => sources.get(file)
        },
        plan: {
            preamble: 'preamble.apexpart',
            imports: [
                { label: 'sample', operation: 'apex', file: 'entry.apexpart' },
                { label: 'unselected', operation: 'apex', file: 'unread.apexpart' }
            ]
        },
        repoRoot
    });
    assert.deepEqual(prepared.sourcePaths, ['preamble.apexpart', 'entry.apexpart']);
    assert.equal(prepared.source, 'Integer count = 1;\n\ncount += 1;\n');
    assert.equal(prepared.repeatCount, 1);
});

test('実際のimport planの全entryを定義順に準備できる', () => {
    // 実際のplanに含まれるすべてのentryを準備する。
    const plan = readPlan({
        fileSystem: fs,
        planPath: 'scripts/setup/plans/import-test-data-plan.json',
        repoRoot
    });
    const preparedEntries = prepareEntries({
        args: {
            defaultRepeat: null,
            only: null,
            repeat: null
        },
        fileSystem: fs,
        plan,
        repoRoot
    });
    assert.deepEqual(
        preparedEntries.map(({ entry }) => entry.label),
        plan.imports.map(({ label }) => label)
    );
    for (const [index, entry] of plan.imports.entries()) {
        assert.deepEqual(
            preparedEntries[index].sourcePaths,
            entry.standalone ? [entry.file] : [plan.preamble, entry.file]
        );
    }
});
