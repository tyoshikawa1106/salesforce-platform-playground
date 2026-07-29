const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getSourcePaths, parseArgs, prepareEntries, readPlan, resolveInsideRepo } = require('../import-test-data-core');

const repoRoot = path.resolve(__dirname, '../../..');

test('CLI引数を型付きの設定へ変換する', () => {
    assert.deepEqual(parseArgs(['--dry-run', '--only', 'contacts', '--repeat', '2', '-o', 'target']), {
        defaultRepeat: null,
        dryRun: true,
        help: false,
        only: 'contacts',
        plan: 'scripts/setup/import-plan.json',
        repeat: 2,
        targetOrg: 'target'
    });
});

test('値が必要なCLIオプションを値なしで指定できない', () => {
    assert.throws(() => parseArgs(['--plan']), /--plan requires a value/);
    assert.throws(() => parseArgs(['--plan', '--dry-run']), /--plan requires a value/);
    assert.throws(() => parseArgs(['--target-org']), /--target-org requires a value/);
});

test('リポジトリ外のパスを拒否する', () => {
    assert.throws(() => resolveInsideRepo(repoRoot, '../outside.apex'), /Path must stay inside the repository/);
});

test('standaloneと共通preamble付きentryのソース構成を判定する', () => {
    const plan = {
        preamble: 'preamble.apex'
    };

    assert.deepEqual(
        getSourcePaths(plan, { file: 'account.apex', label: 'account', operation: 'apex', standalone: true }),
        ['account.apex']
    );
    assert.deepEqual(getSourcePaths(plan, { file: 'case.apex', label: 'case', operation: 'apex' }), [
        'preamble.apex',
        'case.apex'
    ]);
});

test('実際のimport planから共通preambleとobject固有処理を合成する', () => {
    const plan = readPlan({
        fileSystem: fs,
        planPath: 'scripts/setup/import-plan.json',
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

    assert.deepEqual(prepared.sourcePaths, [
        'scripts/apex/test-data/seed-standard-preamble.apexpart',
        'scripts/apex/test-data/seed-standard-cases.apexpart'
    ]);
    assert.match(prepared.source, /String pick\(/);
    assert.match(prepared.source, /List<Case> records/);
    assert.equal(prepared.repeatCount, 1);
});

test('import planの全entryを検証し、共通preambleを重複定義しない', () => {
    const plan = readPlan({
        fileSystem: fs,
        planPath: 'scripts/setup/import-plan.json',
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

    assert.equal(preparedEntries.length, 26);
    assert.equal(composedEntries.length, 23);

    for (const prepared of composedEntries) {
        assert.equal(prepared.sourcePaths[0], plan.preamble);
        assert.equal((prepared.source.match(/String pick\(/g) || []).length, 1);
        assert.ok(prepared.sourcePaths.every((sourcePath) => sourcePath.endsWith('.apexpart')));
    }
});
