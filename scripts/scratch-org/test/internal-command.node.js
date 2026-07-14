const test = require('node:test');
const assert = require('node:assert/strict');
const { runNoArgumentCommand } = require('../internal-command');

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
    let executionCount = 0;
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = runNoArgumentCommand({
        argv: [],
        usage: 'Usage: command',
        execute() {
            executionCount += 1;
        },
        stdout: stdout.stream,
        stderr: stderr.stream
    });

    assert.equal(exitCode, 0);
    assert.equal(executionCount, 1);
    assert.equal(stdout.getValue(), '');
    assert.equal(stderr.getValue(), '');
});

for (const helpFlag of ['--help', '-h']) {
    test(`${helpFlag} は使用方法だけを表示する`, () => {
        let executionCount = 0;
        const stdout = createOutput();
        const stderr = createOutput();

        const exitCode = runNoArgumentCommand({
            argv: [helpFlag],
            usage: 'Usage: command',
            execute() {
                executionCount += 1;
            },
            stdout: stdout.stream,
            stderr: stderr.stream
        });

        assert.equal(exitCode, 0);
        assert.equal(executionCount, 0);
        assert.equal(stdout.getValue(), 'Usage: command\n');
        assert.equal(stderr.getValue(), '');
    });
}

test('未知の引数は処理を実行せずエラーにする', () => {
    let executionCount = 0;
    const stdout = createOutput();
    const stderr = createOutput();

    const exitCode = runNoArgumentCommand({
        argv: ['--unknown', 'value'],
        usage: 'Usage: command',
        execute() {
            executionCount += 1;
        },
        stdout: stdout.stream,
        stderr: stderr.stream
    });

    assert.equal(exitCode, 1);
    assert.equal(executionCount, 0);
    assert.equal(stdout.getValue(), '');
    assert.match(stderr.getValue(), /Unknown argument\(s\): --unknown, value/);
    assert.match(stderr.getValue(), /Usage: command/);
});

test('実処理が返した終了コードを引き継ぐ', () => {
    const exitCode = runNoArgumentCommand({
        argv: [],
        usage: 'Usage: command',
        execute() {
            return 1;
        }
    });

    assert.equal(exitCode, 1);
});
