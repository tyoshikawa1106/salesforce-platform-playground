// 実行コマンド: node --test scripts/org-tests/test/test-progress.node.js
// 用途: 組織テストのSalesforce CLI応答、進捗取得、終了判定、表示処理を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createProgressReporter,
    describeTestRunProgress,
    getTestRunProgress,
    parseSfJson
} = require('../internal/test-progress');
const { createSfResult } = require('./test-helper');

// SalesforceのテストランIDとして扱える固定値を使用する。
const testRunId = '707000000000001AAA';

test('Salesforce CLIの成功結果からresultを取得する', () => {
    assert.deepEqual(parseSfJson(createSfResult({ testRunId }), 'Apexテストの開始'), { testRunId });
});

test('Salesforce CLIを開始できない場合は原因を含めて失敗する', () => {
    assert.throws(
        () =>
            parseSfJson({ error: new Error('起動失敗'), status: null, stderr: '', stdout: '' }, '組織テスト進捗の取得'),
        /組織テスト進捗の取得を開始できませんでした: 起動失敗/
    );
});

test('Salesforce CLIのJSONを解析できない場合は失敗する', () => {
    assert.throws(
        () => parseSfJson({ status: 0, stderr: '', stdout: 'not-json' }, '組織テスト進捗の取得'),
        /組織テスト進捗の取得のJSONを解析できませんでした/
    );
});

test('Salesforce CLIの失敗メッセージを保持する', () => {
    assert.throws(
        () =>
            parseSfJson(
                { status: 1, stderr: '', stdout: JSON.stringify({ message: 'query failed', status: 1 }) },
                '組織テスト進捗の取得'
            ),
        /組織テスト進捗の取得に失敗しました: query failed/
    );
});

test('Tooling APIから対象テストランの進捗を取得する', () => {
    let commandArgs;
    let workingDirectory;
    const progress = getTestRunProgress({
        repoRoot: '/repo',
        targetOrg: 'test-org',
        testRunId,
        runSfWithOutputCommand(args, cwd) {
            commandArgs = args;
            workingDirectory = cwd;
            return createSfResult({ records: [{ ClassesCompleted: 2, ClassesEnqueued: 3, Status: 'Processing' }] });
        }
    });

    assert.deepEqual(progress, { ClassesCompleted: 2, ClassesEnqueued: 3, Status: 'Processing' });
    assert.equal(workingDirectory, '/repo');
    assert.deepEqual(commandArgs.slice(0, 4), ['data', 'query', '--use-tooling-api', '--query']);
    assert.match(commandArgs[4], new RegExp(testRunId));
    assert.deepEqual(commandArgs.slice(5), ['--target-org', 'test-org', '--json']);
});

test('進捗レコードがまだない場合はnullを返す', () => {
    const progress = getTestRunProgress({
        repoRoot: '/repo',
        targetOrg: 'test-org',
        testRunId,
        runSfWithOutputCommand() {
            return createSfResult({ records: [] });
        }
    });

    assert.equal(progress, null);
});

for (const [result, expectedMessage] of [
    [{}, '組織テスト進捗の応答にrecordsがありません。'],
    [{ records: [{}, {}] }, '組織テスト進捗を一意に取得できませんでした。'],
    [{ records: [{ ClassesCompleted: 1, ClassesEnqueued: 2 }] }, '組織テスト進捗に必要な項目がありません。']
]) {
    test(`不正な進捗応答を拒否する: ${expectedMessage}`, () => {
        assert.throws(
            () =>
                getTestRunProgress({
                    repoRoot: '/repo',
                    targetOrg: 'test-org',
                    testRunId,
                    runSfWithOutputCommand() {
                        return createSfResult(result);
                    }
                }),
            new RegExp(expectedMessage)
        );
    });
}

test('進捗なしをキュー登録中として表示する', () => {
    assert.deepEqual(describeTestRunProgress(null), {
        finished: false,
        message: '進捗: キュー登録中'
    });
});

test('実行中と完了済みの進捗を日本語表示と終了判定へ変換する', () => {
    assert.deepEqual(describeTestRunProgress({ ClassesCompleted: 1, ClassesEnqueued: 3, Status: 'Processing' }), {
        finished: false,
        message: '進捗: 1 / 3件完了（実行中）'
    });
    assert.deepEqual(describeTestRunProgress({ ClassesCompleted: 3, ClassesEnqueued: 3, Status: 'Completed' }), {
        finished: true,
        message: '進捗: 3 / 3件完了（完了）'
    });
});

test('TTY以外では更新と完了を行単位で表示する', () => {
    const lines = [];
    const reporter = createProgressReporter({
        stdout: { isTTY: false },
        writeLine(message) {
            lines.push(message);
        }
    });

    reporter.update('実行中');
    reporter.finish('完了');

    assert.deepEqual(lines, ['実行中', '完了']);
});

test('TTYでは同じ行を更新し、短いメッセージの残りを空白で消す', () => {
    let output = '';
    const reporter = createProgressReporter({
        stdout: {
            isTTY: true,
            write(message) {
                output += message;
            }
        }
    });

    reporter.update('長いメッセージ');
    reporter.finish('完了');

    assert.equal(output, '\r長いメッセージ\r完了     \n');
});
