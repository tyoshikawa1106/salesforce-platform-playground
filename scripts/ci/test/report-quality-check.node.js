// 実行コマンド: node --test scripts/ci/test/report-quality-check.node.js
// 用途: 定期品質チェックの失敗、継続失敗、復旧時のIssue操作を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatJstTimestamp, main, reportCheck, runGh } = require('../report-quality-check');

const fixedDate = new Date('2026-08-22T07:00:00.000Z');
const baseContext = {
    actor: 'ci-actor',
    checkName: 'Nightly npm checks',
    now: () => fixedDate,
    runUrl: 'https://github.example/actions/runs/123',
    sha: 'abc123'
};

// GitHub CLIの引数を記録し、open Issue一覧だけ指定値で返す。
function createGhRecorder(openIssues = []) {
    const calls = [];

    return {
        calls,
        runGhCommand(args) {
            calls.push(args);
            return args[0] === 'issue' && args[1] === 'list' ? JSON.stringify(openIssues) : '';
        }
    };
}

test('JST日時を固定形式で表示する', () => {
    assert.equal(formatJstTimestamp(fixedDate), '2026-08-22 16:00:00 JST');
    assert.equal(formatJstTimestamp(new Date('2026-08-21T15:00:00.000Z')), '2026-08-22 00:00:00 JST');
});

test('対象外の結果ではGitHub CLIを実行しない', () => {
    const recorder = createGhRecorder();

    for (const result of ['skipped', 'cancelled', undefined]) {
        reportCheck({ ...baseContext, result, runGhCommand: recorder.runGhCommand });
    }

    assert.deepEqual(recorder.calls, []);
});

test('初回失敗時はラベルと担当者を指定してIssueを作成する', () => {
    const recorder = createGhRecorder();

    reportCheck({ ...baseContext, result: 'failure', runGhCommand: recorder.runGhCommand });

    assert.deepEqual(recorder.calls[0], [
        'issue',
        'list',
        '--state',
        'open',
        '--search',
        '"CI: Nightly npm checksが失敗しています" in:title',
        '--limit',
        '1000',
        '--json',
        'number,title'
    ]);
    assert.deepEqual(recorder.calls[1].slice(0, 4), [
        'issue',
        'create',
        '--title',
        'CI: Nightly npm checksが失敗しています'
    ]);
    assert.equal(recorder.calls[1].includes('bug'), true);
    assert.equal(recorder.calls[1].includes('area:testing'), true);
    assert.equal(recorder.calls[1].at(-1), 'ci-actor');

    const body = recorder.calls[1][recorder.calls[1].indexOf('--body') + 1];
    assert.match(body, /検知日時: 2026-08-22 16:00:00 JST/);
    assert.match(body, /対象コミット: `abc123`/);
    assert.match(body, /https:\/\/github\.example\/actions\/runs\/123/);
});

test('継続失敗時は同じタイトルのopen Issueへコメントする', () => {
    const recorder = createGhRecorder([
        { number: 42, title: 'CI: Nightly npm checksが失敗しています' },
        { number: 99, title: '別のIssue' }
    ]);

    reportCheck({ ...baseContext, result: 'failure', runGhCommand: recorder.runGhCommand });

    assert.equal(recorder.calls.length, 2);
    assert.deepEqual(recorder.calls[1].slice(0, 3), ['issue', 'comment', '42']);
});

test('成功時は同じタイトルのopen Issueへ復旧コメントを追加してクローズする', () => {
    const recorder = createGhRecorder([{ number: 42, title: 'CI: Nightly npm checksが失敗しています' }]);

    reportCheck({ ...baseContext, result: 'success', runGhCommand: recorder.runGhCommand });

    assert.equal(recorder.calls.length, 3);
    assert.deepEqual(recorder.calls[1].slice(0, 3), ['issue', 'comment', '42']);
    assert.match(recorder.calls[1][4], /復旧確認日時: 2026-08-22 16:00:00 JST/);
    assert.deepEqual(recorder.calls[2], ['issue', 'close', '42', '--reason', 'completed']);
});

test('成功時に対応するopen Issueがなければ更新しない', () => {
    const recorder = createGhRecorder();

    reportCheck({ ...baseContext, result: 'success', runGhCommand: recorder.runGhCommand });

    assert.equal(recorder.calls.length, 1);
    assert.deepEqual(recorder.calls[0].slice(0, 2), ['issue', 'list']);
});

test('open Issue一覧がJSONでない場合は処理を中止する', () => {
    assert.throws(
        () => reportCheck({ ...baseContext, result: 'failure', runGhCommand: () => 'not-json' }),
        /open Issue一覧のJSONを解析できませんでした/
    );
});

test('workflowの環境変数から2つのチェック結果を処理する', () => {
    const recorder = createGhRecorder();

    main({
        env: {
            GITHUB_ACTOR: 'ci-actor',
            GITHUB_SHA: 'abc123',
            NPM_RESULT: 'failure',
            RUN_URL: 'https://github.example/actions/runs/123',
            WINDOWS_RESULT: 'skipped'
        },
        now: () => fixedDate,
        runGhCommand: recorder.runGhCommand
    });

    assert.equal(recorder.calls.length, 2);
    assert.deepEqual(recorder.calls[1].slice(0, 2), ['issue', 'create']);
});

test('GitHub CLIをshell経由なしで実行して標準出力を返す', () => {
    const output = runGh(['issue', 'list'], (command, args, options) => {
        assert.equal(command, 'gh');
        assert.deepEqual(args, ['issue', 'list']);
        assert.deepEqual(options, { encoding: 'utf8' });
        return { status: 0, stderr: '', stdout: '[]' };
    });

    assert.equal(output, '[]');
});

test('GitHub CLIの起動失敗と終了コードをエラーとして扱う', () => {
    assert.throws(
        () => runGh(['issue', 'list'], () => ({ error: new Error('not found'), status: null })),
        /GitHub CLIを開始できませんでした: not found/
    );
    assert.throws(
        () => runGh(['issue', 'list'], () => ({ status: 1, stderr: 'permission denied', stdout: '' })),
        /GitHub CLIが失敗しました: permission denied/
    );
});
