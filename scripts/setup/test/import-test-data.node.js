// 実行コマンド: node --test scripts/setup/test/import-test-data.node.js
// 用途: テストデータ投入入口のdry-run、組織指定、失敗時の後始末を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { run } = require('../import-test-data');

test('dry-runではSalesforce CLIを実行しない', () => {
    // 1つのentryをdry-runし、外部処理の呼び出し回数を記録する。
    let executionCount = 0;
    run({
        argv: ['--dry-run', '--only', 'standard-objects-accounts'],
        runSfCommand() {
            executionCount += 1;
        }
    });

    // ファイル検証と予定表示だけで終了することを確認する。
    assert.equal(executionCount, 0);
});

test('実投入にはTarget Orgの指定を必須とする', () => {
    // 組織を指定しない実投入を、Salesforce CLI実行前に拒否する。
    assert.throws(
        () => run({ argv: ['--only', 'standard-objects-accounts'] }),
        /実投入には--target-org <alias>の指定が必要です/
    );
});

test('Salesforce CLI失敗時は一時Apexファイルを削除して終了する', () => {
    // 最初のentryでCLIを失敗させ、生成された一時ファイルを記録する。
    let generatedFilePath;
    assert.throws(
        () =>
            run({
                argv: ['--only', 'standard-objects-accounts', '--target-org', 'test-org'],
                runSfCommand(args) {
                    generatedFilePath = args[args.indexOf('--file') + 1];
                    assert.equal(fs.existsSync(generatedFilePath), true);
                    return { status: 1, stdout: '', stderr: '' };
                }
            }),
        /sfコマンドが失敗しました（standard-objects-accounts）/
    );

    // CLI失敗後に合成済みApexが残らないことを確認する。
    assert.equal(fs.existsSync(generatedFilePath), false);
});

test('Salesforce CLIを開始できない場合も一時Apexファイルを削除する', () => {
    // CLIの起動エラーを返し、生成された一時ファイルを記録する。
    let generatedFilePath;
    assert.throws(
        () =>
            run({
                argv: ['--only', 'standard-objects-accounts', '--target-org', 'test-org'],
                runSfCommand(args) {
                    generatedFilePath = args[args.indexOf('--file') + 1];
                    return { error: new Error('起動失敗'), status: null, stdout: '', stderr: '' };
                }
            }),
        /sfコマンドを開始できませんでした（standard-objects-accounts）: 起動失敗/
    );

    // 起動できなかった場合も合成済みApexが残らないことを確認する。
    assert.equal(fs.existsSync(generatedFilePath), false);
});

test('Salesforce CLI成功時も一時Apexファイルを削除する', () => {
    // CLIを成功させ、実行時に存在した一時ファイルを記録する。
    let generatedFilePath;
    run({
        argv: ['--only', 'standard-objects-accounts', '--target-org', 'test-org'],
        runSfCommand(args) {
            generatedFilePath = args[args.indexOf('--file') + 1];
            assert.equal(fs.existsSync(generatedFilePath), true);
            return { status: 0, stdout: '', stderr: '' };
        }
    });

    // 正常終了後も合成済みApexが残らないことを確認する。
    assert.equal(fs.existsSync(generatedFilePath), false);
});
