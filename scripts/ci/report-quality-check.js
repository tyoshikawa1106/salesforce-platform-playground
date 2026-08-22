// 実行方法: GitHub Actionsの定期品質チェック結果報告jobから実行する。
// 用途: チェック失敗時のIssue作成・更新と、復旧時のIssueクローズを行う。

const { spawnSync } = require('node:child_process');

// workflowから受け付ける結果を、Issue更新が必要な状態だけに限定する。
const supportedResults = new Set(['failure', 'success']);

// GitHub CLIをshell経由なしで実行し、標準出力を呼び出し元へ返す。
function runGh(args, spawnCommand = spawnSync) {
    // shell展開を避け、受け取った引数をそのままGitHub CLIへ渡す。
    const result = spawnCommand('gh', args, { encoding: 'utf8' });

    // プロセス自体を開始できない場合はCLIの終了コードとは分けて報告する。
    if (result.error) {
        throw new Error(`GitHub CLIを開始できませんでした: ${result.error.message}`);
    }

    // GitHub CLIが返した詳細を、標準エラー出力を優先して残す。
    if (result.status !== 0) {
        const detail = `${result.stderr || result.stdout || ''}`.trim();
        throw new Error(`GitHub CLIが失敗しました${detail ? `: ${detail}` : '。'}`);
    }

    return result.stdout || '';
}

// 日時をIssue本文で使用するJST表記へ変換する。
function formatJstTimestamp(date) {
    // 実行環境のlocaleやtimezoneに依存しない固定形式を使用する。
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
    // literalを除いた各日時要素を、名前で参照できるオブジェクトへ変換する。
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
    // 同名Issueの重複作成を避けるため、open IssueをJSONで取得する。
    const output = runGhCommand(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title']);
    let issues;

    // GitHub CLIの応答形式が崩れた場合は更新処理を中断する。
    try {
        issues = JSON.parse(output);
    } catch (error) {
        throw new Error(`open Issue一覧のJSONを解析できませんでした: ${error.message}`);
    }

    // 後続の検索が安全に行える配列だけを受け付ける。
    if (!Array.isArray(issues)) {
        throw new Error('open Issue一覧が配列ではありません。');
    }

    // タイトルが完全一致する監視Issueだけを更新対象にする。
    const issue = issues.find(({ title }) => title === issueTitle);
    return Number.isInteger(issue?.number) ? issue.number : null;
}

// チェック結果をIssueへ記録し、成功時は既存の障害検知Issueをクローズする。
function reportCheck({ actor, checkName, now = () => new Date(), result, runGhCommand = runGh, runUrl, sha }) {
    // cancelledやskippedなど、障害または復旧を表さない結果は処理しない。
    if (!supportedResults.has(result)) {
        return;
    }

    // チェック名から一意な監視Issueタイトルを組み立てる。
    const issueTitle = `CI: ${checkName}が失敗しています`;
    // 既存Issueがあればコメント更新、なければ新規作成へ分岐する。
    const issueNumber = findOpenIssue(issueTitle, runGhCommand);

    if (result === 'failure') {
        // 発生時点のコミットと実行ログを、再調査に必要な最小情報として記録する。
        const failureMessage = `${checkName}で失敗を検知しました。\n\n- 検知日時: ${formatJstTimestamp(now())}\n- 対象コミット: \`${sha}\`\n- 実行結果: ${result}\n- 実行ログ: ${runUrl}`;

        // 継続中の障害は同じIssueへ追記し、通知先を分散させない。
        if (issueNumber !== null) {
            runGhCommand(['issue', 'comment', String(issueNumber), '--body', failureMessage]);
            return;
        }

        // 初回検知時だけ担当者と分類を指定してIssueを作成する。
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
        // 復旧根拠を残してから、監視Issueをcompletedとして閉じる。
        const recoveryMessage = `${checkName}の成功を確認したため、このIssueをクローズします。\n\n- 復旧確認日時: ${formatJstTimestamp(now())}\n- 対象コミット: \`${sha}\`\n- 実行ログ: ${runUrl}`;
        runGhCommand(['issue', 'comment', String(issueNumber), '--body', recoveryMessage]);
        runGhCommand(['issue', 'close', String(issueNumber), '--reason', 'completed']);
    }
}

// GitHub Actionsから渡された各jobの結果を、同じルールで順番に処理する。
function main({ env = process.env, now = () => new Date(), runGhCommand = runGh } = {}) {
    // workflow共通の実行情報を1つにまとめ、各品質チェックへ再利用する。
    const context = {
        actor: env.GITHUB_ACTOR,
        now,
        runGhCommand,
        runUrl: env.RUN_URL,
        sha: env.GITHUB_SHA
    };

    // 各jobの結果を独立した監視Issueとして順番に反映する。
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
