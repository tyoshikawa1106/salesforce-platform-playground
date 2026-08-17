// 実行コマンド: node --test scripts/scratch-org/test/command.node.js
// 用途: Scratch Org alias、help、エラー、終了コードを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { runAliasCommand } = require('../internal/command');

// 標準出力とエラー出力をテスト内で確認できる簡易ストリームを作る。
function createOutput() {
    let value = '';

    return {
        stream: {
            write(chunk) {
                value += chunk;
            }
        },
        getValue() {
            return value;
        }
    };
}

test('引数なしの場合は既定aliasで処理を実行する', () => {
    // 実処理へ渡されたaliasと出力内容を記録する。
    let executedAlias = null;
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = runAliasCommand({
        argv: [],
        defaultAlias: 'scratch-org',
        usage: '実行コマンド: command [--alias <alias>]',
        execute(alias) {
            executedAlias = alias;
        },
        stdout: stdout.stream,
        stderr: stderr.stream
    });

    // 正常終了し、既定aliasで実処理を実行することを確認する。
    assert.equal(exitCode, 0);
    assert.equal(executedAlias, 'scratch-org');
    assert.equal(stdout.getValue(), '');
    assert.equal(stderr.getValue(), '');
});

test('--aliasで指定したaliasを実処理へ渡す', () => {
    // OSのシェル構文を使わず、Node.js引数からaliasを受け取る。
    let executedAlias = null;
    const exitCode = runAliasCommand({
        argv: ['--alias', 'scratch-org-2'],
        defaultAlias: 'scratch-org',
        usage: '実行コマンド: command [--alias <alias>]',
        execute(alias) {
            executedAlias = alias;
        }
    });

    // 指定したaliasが変更されずに渡ることを確認する。
    assert.equal(exitCode, 0);
    assert.equal(executedAlias, 'scratch-org-2');
});

for (const helpFlag of ['--help', '-h']) {
    test(`${helpFlag} は使用方法だけを表示する`, () => {
        // 各helpオプションの実行回数と出力内容を記録する。
        let executionCount = 0;
        const stdout = createOutput();
        const stderr = createOutput();

        const exitCode = runAliasCommand({
            argv: [helpFlag],
            defaultAlias: 'scratch-org',
            usage: '実行コマンド: command [--alias <alias>]',
            execute() {
                executionCount += 1;
            },
            stdout: stdout.stream,
            stderr: stderr.stream
        });

        // 使用方法だけを表示し、実処理を実行しないことを確認する。
        assert.equal(exitCode, 0);
        assert.equal(executionCount, 0);
        assert.equal(stdout.getValue(), '実行コマンド: command [--alias <alias>]\n');
        assert.equal(stderr.getValue(), '');
    });
}

test('alias必須のコマンドは未指定をエラーにする', () => {
    // 削除コマンドと同じalias必須条件で実行する。
    const stdout = createOutput();
    const stderr = createOutput();
    const exitCode = runAliasCommand({
        aliasRequired: true,
        argv: [],
        usage: '実行コマンド: command --alias <alias>',
        execute() {},
        stdout: stdout.stream,
        stderr: stderr.stream
    });

    // 組織操作を始めず、aliasの指定方法を表示することを確認する。
    assert.equal(exitCode, 1);
    assert.equal(stdout.getValue(), '');
    assert.match(stderr.getValue(), /Scratch Orgのaliasを--alias <alias>で指定してください/);
    assert.match(stderr.getValue(), /実行コマンド: command --alias <alias>/);
});

test('--aliasの値がない場合はエラーにする', () => {
    // 値を指定せずに--aliasだけを渡す。
    const stderr = createOutput();
    const exitCode = runAliasCommand({
        argv: ['--alias'],
        defaultAlias: 'scratch-org',
        usage: '実行コマンド: command [--alias <alias>]',
        execute() {},
        stderr: stderr.stream
    });

    // 値が必要であることを日本語で表示する。
    assert.equal(exitCode, 1);
    assert.match(stderr.getValue(), /--aliasには値が必要です/);
});

test('未知の引数は処理を実行せずエラーにする', () => {
    // 未知の引数を指定した場合の実行回数と出力内容を記録する。
    let executionCount = 0;
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = runAliasCommand({
        argv: ['--unknown', 'value'],
        defaultAlias: 'scratch-org',
        usage: '実行コマンド: command [--alias <alias>]',
        execute() {
            executionCount += 1;
        },
        stdout: stdout.stream,
        stderr: stderr.stream
    });

    // 異常終了し、実処理を実行せずエラー内容を表示することを確認する。
    assert.equal(exitCode, 1);
    assert.equal(executionCount, 0);
    assert.equal(stdout.getValue(), '');
    assert.match(stderr.getValue(), /未対応の引数が指定されました: --unknown, value/);
    assert.match(stderr.getValue(), /実行コマンド: command/);
});

test('実処理が返した終了コードを引き継ぐ', () => {
    // 終了コード1を返す実処理を実行する。
    const exitCode = runAliasCommand({
        argv: [],
        defaultAlias: 'scratch-org',
        usage: '実行コマンド: command [--alias <alias>]',
        execute() {
            return 1;
        }
    });

    // 実処理の終了コードが維持されることを確認する。
    assert.equal(exitCode, 1);
});

test('実処理の例外をスタックトレースなしで表示する', () => {
    // 子処理が例外を返す状況を再現する。
    const stderr = createOutput();
    const exitCode = runAliasCommand({
        argv: [],
        defaultAlias: 'scratch-org',
        usage: '実行コマンド: command [--alias <alias>]',
        execute() {
            throw new Error('テスト用エラー');
        },
        stderr: stderr.stream
    });

    // エラー内容と使用方法だけを表示し、スタックトレースを含めないことを確認する。
    assert.equal(exitCode, 1);
    assert.equal(stderr.getValue(), 'エラー: テスト用エラー\n実行コマンド: command [--alias <alias>]\n');
});
