// 実行方法: GitHub Actionsの定期品質チェック結果報告jobから実行する。
// 用途: チェック失敗時のIssue作成・更新と、復旧時のIssueクローズを行う。

const { spawnSync } = require('node:child_process');

const supportedResults = new Set(['failure', 'success']);

// GitHub CLIをshell経由なしで実行し、標準出力を呼び出し元へ返す。
function runGh(args, spawnCommand = spawnSync) {
    const result = spawnCommand('gh', args, { encoding: 'utf8' });

    if (result.error) {
        throw new Error(`GitHub CLIを開始できませんでした: ${result.error.message}`);
    }

    if (result.status !== 0) {
        const detail = `${result.stderr || result.stdout || ''}`.trim();
        throw new Error(`GitHub CLIが失敗しました${detail ? `: ${detail}` : '。'}`);
    }

    return result.stdout || '';
}

// 日時をIssue本文で使用するJST表記へ変換する。
function formatJstTimestamp(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Tokyo',
        year: 'numeric'
    });
    const parts = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter(({ type }) => type !== 'literal')
            .map(({ type, value }) => [type, value])
    );

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} JST`;
}

// open Issue一覧から、チェック名に対応するIssue番号を取得する。
function findOpenIssue(issueTitle, runGhCommand) {
    const output = runGhCommand(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title']);
    let issues;

    try {
        issues = JSON.parse(output);
    } catch (error) {
        throw new Error(`open Issue一覧のJSONを解析できませんでした: ${error.message}`);
    }

    if (!Array.isArray(issues)) {
        throw new Error('open Issue一覧が配列ではありません。');
    }

    const issue = issues.find(({ title }) => title === issueTitle);
    return Number.isInteger(issue?.number) ? issue.number : null;
}

// チェック結果をIssueへ記録し、成功時は既存の障害検知Issueをクローズする。
function reportCheck({ actor, checkName, now = () => new Date(), result, runGhCommand = runGh, runUrl, sha }) {
    if (!supportedResults.has(result)) {
        return;
    }

    const issueTitle = `CI: ${checkName}が失敗しています`;
    const issueNumber = findOpenIssue(issueTitle, runGhCommand);

    if (result === 'failure') {
        const failureMessage = `${checkName}で失敗を検知しました。\n\n- 検知日時: ${formatJstTimestamp(now())}\n- 対象コミット: \`${sha}\`\n- 実行結果: ${result}\n- 実行ログ: ${runUrl}`;

        if (issueNumber !== null) {
            runGhCommand(['issue', 'comment', String(issueNumber), '--body', failureMessage]);
            return;
        }

        runGhCommand([
            'issue',
            'create',
            '--title',
            issueTitle,
            '--body',
            failureMessage,
            '--label',
            'bug',
            '--label',
            'area:testing',
            '--assignee',
            actor
        ]);
        return;
    }

    if (issueNumber !== null) {
        const recoveryMessage = `${checkName}の成功を確認したため、このIssueをクローズします。\n\n- 復旧確認日時: ${formatJstTimestamp(now())}\n- 対象コミット: \`${sha}\`\n- 実行ログ: ${runUrl}`;
        runGhCommand(['issue', 'comment', String(issueNumber), '--body', recoveryMessage]);
        runGhCommand(['issue', 'close', String(issueNumber), '--reason', 'completed']);
    }
}

// GitHub Actionsから渡された各jobの結果を、同じルールで順番に処理する。
function main({ env = process.env, now = () => new Date(), runGhCommand = runGh } = {}) {
    const context = {
        actor: env.GITHUB_ACTOR,
        now,
        runGhCommand,
        runUrl: env.RUN_URL,
        sha: env.GITHUB_SHA
    };

    reportCheck({ ...context, checkName: 'Nightly npm checks', result: env.NPM_RESULT });
    reportCheck({ ...context, checkName: 'Weekly Windows script checks', result: env.WINDOWS_RESULT });
}

// workflowから直接実行された場合だけGitHubのIssueを更新する。
if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`エラー: 定期品質チェック結果を報告できませんでした: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = { findOpenIssue, formatJstTimestamp, main, reportCheck, runGh };
