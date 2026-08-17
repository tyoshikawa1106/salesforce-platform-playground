// 実行コマンド: node --test scripts/scratch-org/test/setup.node.js
// 用途: Scratch Orgの準備手順と失敗時の停止を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../setup');

// テスト中の標準出力とエラー出力を記録する。
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

const expectedScripts = [
    'scripts/scratch-org/steps/create.js',
    'scripts/scratch-org/steps/deploy.js',
    'scripts/scratch-org/steps/assign-permission-set.js',
    'scripts/scratch-org/steps/import-test-data.js'
];

test('同じaliasでScratch Orgの準備手順を順番に実行する', () => {
    // 実行された子スクリプトと引数を記録する。
    const calls = [];
    const stdout = createOutput();
    const status = main({
        argv: ['--alias', 'test-scratch-org'],
        stdout: stdout.stream,
        runNodeScriptCommand(scriptPath, args) {
            calls.push({ scriptPath, args });
            return 0;
        }
    });

    // 4つの手順が定義順かつ同じaliasで実行されることを確認する。
    assert.equal(status, 0);
    assert.deepEqual(
        calls.map((call) => call.scriptPath),
        expectedScripts
    );
    assert.ok(calls.every((call) => call.args.join(' ') === '--alias test-scratch-org'));
    assert.match(stdout.getValue(), /使用するScratch Org alias: test-scratch-org/);
});

test('準備手順が失敗した場合は後続処理を実行しない', () => {
    // 2番目のメタデータ反映を失敗させる。
    const calls = [];
    const stderr = createOutput();
    const status = main({
        argv: [],
        stderr: stderr.stream,
        stdout: createOutput().stream,
        runNodeScriptCommand(scriptPath) {
            calls.push(scriptPath);
            return calls.length === 2 ? 7 : 0;
        }
    });

    // 失敗した終了コードを返し、3番目以降を実行しないことを確認する。
    assert.equal(status, 7);
    assert.deepEqual(calls, expectedScripts.slice(0, 2));
    assert.match(stderr.getValue(), /メタデータの反映に失敗したため/);
});
