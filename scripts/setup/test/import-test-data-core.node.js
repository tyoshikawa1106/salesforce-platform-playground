// 実行コマンド: node --test scripts/setup/test/import-test-data-core.node.js
// 用途: テストデータ投入の引数、パス、plan、Apexソース構成を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    getSourcePaths,
    parseArgs,
    prepareEntries,
    readPlan,
    resolveInsideRepo
} = require('../internal/import-test-data-core');

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

test('未知のCLIオプションを日本語のエラーで拒否する', () => {
    // 未対応のオプション名を含むエラーが返されることを確認する。
    assert.throws(() => parseArgs(['--unknown']), /未対応の引数が指定されました: --unknown/);
});

test('リポジトリ外のパスを拒否する', () => {
    // 親ディレクトリへ移動する相対パスが拒否されることを確認する。
    assert.throws(() => resolveInsideRepo(repoRoot, '../outside.apex'), /リポジトリ内のパスを指定してください/);
});

test('standaloneと共通preamble付きentryのソース構成を判定する', () => {
    // 共通preambleを持つ最小構成のplanを用意する。
    const plan = {
        preamble: 'preamble.apex'
    };

    // standaloneではentry自身のファイルだけを使用する。
    assert.deepEqual(
        getSourcePaths(plan, { file: 'account.apex', label: 'account', operation: 'apex', standalone: true }),
        ['account.apex']
    );
    // 通常entryではpreambleとentry自身のファイルを使用する。
    assert.deepEqual(getSourcePaths(plan, { file: 'case.apex', label: 'case', operation: 'apex' }), [
        'preamble.apex',
        'case.apex'
    ]);
});

test('実際のimport planから共通preambleとobject固有処理を合成する', () => {
    // 実際のplanからCase用entryだけを準備する。
    const plan = readPlan({
        fileSystem: fs,
        planPath: 'scripts/setup/plans/import-test-data-plan.json',
        repoRoot
    });
    const [prepared] = prepareEntries({
        args: {
            defaultRepeat: null,
            only: 'standard-objects-cases',
            repeat: null
        },
        fileSystem: fs,
        plan,
        repoRoot
    });

    // preambleとCase固有処理が1つの実行ソースへ合成されることを確認する。
    assert.deepEqual(prepared.sourcePaths, [
        'scripts/apex/test-data/seed-standard-preamble.apexpart',
        'scripts/apex/test-data/seed-standard-cases.apexpart'
    ]);
    assert.match(prepared.source, /String pick\(/);
    assert.match(prepared.source, /List<Case> records/);
    assert.equal(prepared.repeatCount, 1);
});

test('import planの全entryを検証し、共通preambleを重複定義しない', () => {
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
    const composedEntries = preparedEntries.filter((prepared) => !prepared.entry.standalone);

    // 固定件数ではなく、現在のplan全体が漏れなく準備されたことを確認する。
    assert.equal(preparedEntries.length, plan.imports.length);
    assert.equal(composedEntries.length, plan.imports.filter((entry) => !entry.standalone).length);

    // 各合成ソースがpreambleを1回だけ含むことを確認する。
    for (const prepared of composedEntries) {
        assert.equal(prepared.sourcePaths[0], plan.preamble);
        assert.equal((prepared.source.match(/String pick\(/g) || []).length, 1);
        assert.ok(prepared.sourcePaths.every((sourcePath) => sourcePath.endsWith('.apexpart')));
    }
});
