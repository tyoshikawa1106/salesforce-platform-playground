// 実行コマンド: node --test scripts/scratch-org/test/command.node.js
// 用途: 引数なしコマンドのhelp、未知の引数、終了コードを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { runNoArgumentCommand } = require('../internal/command');

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

test('引数なしの場合だけ処理を実行する', () => {
    // 実処理の実行回数と出力内容を記録する。
    let executionCount = 0;
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = runNoArgumentCommand({
        argv: [],
        usage: '実行コマンド: command',
        execute() {
            executionCount += 1;
        },
        stdout: stdout.stream,
        stderr: stderr.stream
    });

    // 正常終了し、実処理だけが1回実行されることを確認する。
    assert.equal(exitCode, 0);
    assert.equal(executionCount, 1);
    assert.equal(stdout.getValue(), '');
    assert.equal(stderr.getValue(), '');
});

for (const helpFlag of ['--help', '-h']) {
    test(`${helpFlag} は使用方法だけを表示する`, () => {
        // 各helpオプションの実行回数と出力内容を記録する。
        let executionCount = 0;
        const stdout = createOutput();
        const stderr = createOutput();

        const exitCode = runNoArgumentCommand({
            argv: [helpFlag],
            usage: '実行コマンド: command',
            execute() {
                executionCount += 1;
            },
            stdout: stdout.stream,
            stderr: stderr.stream
        });

        // 使用方法だけを表示し、実処理を実行しないことを確認する。
        assert.equal(exitCode, 0);
        assert.equal(executionCount, 0);
        assert.equal(stdout.getValue(), '実行コマンド: command\n');
        assert.equal(stderr.getValue(), '');
    });
}

test('未知の引数は処理を実行せずエラーにする', () => {
    // 未知の引数を指定した場合の実行回数と出力内容を記録する。
    let executionCount = 0;
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = runNoArgumentCommand({
        argv: ['--unknown', 'value'],
        usage: '実行コマンド: command',
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
    const exitCode = runNoArgumentCommand({
        argv: [],
        usage: '実行コマンド: command',
        execute() {
            return 1;
        }
    });

    // 実処理の終了コードが維持されることを確認する。
    assert.equal(exitCode, 1);
});
