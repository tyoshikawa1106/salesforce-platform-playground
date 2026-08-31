// 実行コマンド: node --test scripts/setup/test/import-test-data-runner.node.js
// 用途: テストデータ投入entryの表示、Salesforce CLI実行、一時ファイル削除を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { runPreparedEntries } = require('../internal/import-test-data-runner');

// runnerへ渡す最小の準備済みentryを作成する。
function createPreparedEntries(repeatCount = 1) {
    return [
        {
            entry: { label: 'standard-objects-accounts' },
            repeatCount,
            source: "System.debug('test');\n",
            sourcePaths: ['scripts/apex/test-data/preamble.apexpart', 'scripts/apex/test-data/accounts.apexpart']
        }
    ];
}

// stdoutとstderrへ書き込まれた内容を検証できる出力先を作成する。
function createOutput() {
    let value = '';

    return {
        stream: {
            write(chunk) {
                value += chunk;
            }
        },
        value() {
            return value;
        }
    };
}

test('dry-runでは一時ファイルとSalesforce CLIを使用せず実行予定を表示する', () => {
    const stdout = createOutput();

    runPreparedEntries({
        dryRun: true,
        fileSystem: {
            mkdtempSync() {
                assert.fail('dry-runで一時ディレクトリを作成してはいけません。');
            }
        },
        operatingSystem: os,
        preparedEntries: createPreparedEntries(2),
        repoRoot: '/repo',
        runSfCommand() {
            assert.fail('dry-runでSalesforce CLIを実行してはいけません。');
        },
        stderr: createOutput().stream,
        stdout: stdout.stream,
        targetOrg: '<default-target-org>'
    });

    assert.match(stdout.value(), /\[dry-run\] standard-objects-accounts \(1\/2\)/);
    assert.match(stdout.value(), /\[dry-run\] standard-objects-accounts \(2\/2\)/);
    assert.match(
        stdout.value(),
        /sf apex run --file <generated:standard-objects-accounts\.apex> --target-org <default-target-org>/
    );
});

test('実投入ではCLIの要約を表示し、成功後に一時ファイルを削除する', () => {
    let generatedFilePath;
    const stdout = createOutput();

    runPreparedEntries({
        dryRun: false,
        fileSystem: fs,
        operatingSystem: os,
        preparedEntries: createPreparedEntries(),
        repoRoot: '/repo',
        runSfCommand(args, workingDirectory) {
            generatedFilePath = args[args.indexOf('--file') + 1];
            assert.equal(fs.existsSync(generatedFilePath), true);
            assert.equal(workingDirectory, '/repo');
            return {
                status: 0,
                stderr: '',
                stdout:
                    'USER_DEBUG|[1]|DEBUG|Deleted records: Account=1\n' +
                    'USER_DEBUG|[2]|DEBUG|Created records: Account=1\n'
            };
        },
        stderr: createOutput().stream,
        stdout: stdout.stream,
        targetOrg: 'test-org'
    });

    assert.equal(fs.existsSync(generatedFilePath), false);
    assert.match(stdout.value(), /\[import\] standard-objects-accounts/);
    assert.match(stdout.value(), /Deleted records: Account=1/);
    assert.match(stdout.value(), /Created records: Account=1/);
});

test('Salesforce CLI失敗時は元の出力を残し、一時ファイルを削除する', () => {
    let generatedFilePath;
    const stderr = createOutput();
    const stdout = createOutput();

    assert.throws(
        () =>
            runPreparedEntries({
                dryRun: false,
                fileSystem: fs,
                operatingSystem: os,
                preparedEntries: createPreparedEntries(),
                repoRoot: '/repo',
                runSfCommand(args) {
                    generatedFilePath = args[args.indexOf('--file') + 1];
                    return { status: 1, stderr: 'CLI error\n', stdout: 'CLI output\n' };
                },
                stderr: stderr.stream,
                stdout: stdout.stream,
                targetOrg: 'test-org'
            }),
        /sfコマンドが失敗しました（standard-objects-accounts）/
    );

    assert.equal(fs.existsSync(generatedFilePath), false);
    assert.match(stdout.value(), /CLI output/);
    assert.equal(stderr.value(), 'CLI error\n');
});

test('Salesforce CLIを開始できない場合も一時ファイルを削除する', () => {
    let generatedFilePath;

    assert.throws(
        () =>
            runPreparedEntries({
                dryRun: false,
                fileSystem: fs,
                operatingSystem: os,
                preparedEntries: createPreparedEntries(),
                repoRoot: '/repo',
                runSfCommand(args) {
                    generatedFilePath = args[args.indexOf('--file') + 1];
                    return { error: new Error('起動失敗'), status: null, stderr: '', stdout: '' };
                },
                stderr: createOutput().stream,
                stdout: createOutput().stream,
                targetOrg: 'test-org'
            }),
        /sfコマンドを開始できませんでした（standard-objects-accounts）: 起動失敗/
    );

    assert.equal(fs.existsSync(generatedFilePath), false);
});
