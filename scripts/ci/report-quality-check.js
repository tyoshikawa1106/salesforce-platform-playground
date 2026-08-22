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
        // 呼び出し元が原因を確認できるようspawnエラーの詳細を保持する。
        throw new Error(`GitHub CLIを開始できませんでした: ${result.error.message}`);
    }

    // GitHub CLIが返した詳細を、標準エラー出力を優先して残す。
    if (result.status !== 0) {
        // stderrが空の場合だけstdoutを診断情報として使用する。
        const detail = `${result.stderr || result.stdout || ''}`.trim();
        // 出力がある場合はGitHub CLIの失敗理由を共通エラーへ含める。
        throw new Error(`GitHub CLIが失敗しました${detail ? `: ${detail}` : '。'}`);
    }

    // 成功時の標準出力を常に文字列として返す。
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

    // Issue本文で比較しやすい年月日、時分秒、timezoneの順へ組み立てる。
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} JST`;
}

// open Issue一覧から、チェック名に対応するIssue番号を取得する。
function findOpenIssue(issueTitle, runGhCommand) {
    // 同名Issueの重複作成を避けるため、open IssueをJSONで取得する。
    const output = runGhCommand(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title']);
    // JSON解析が完了するまで候補一覧を未確定として保持する。
    let issues;

    // GitHub CLIの応答形式が崩れた場合は更新処理を中断する。
    try {
        // GitHub CLIから受け取った文字列をIssue配列へ変換する。
        issues = JSON.parse(output);
    } catch (error) {
        // 不正な応答を空一覧として扱わず、監視Issueの誤作成を防ぐ。
        throw new Error(`open Issue一覧のJSONを解析できませんでした: ${error.message}`);
    }

    // 後続の検索が安全に行える配列だけを受け付ける。
    if (!Array.isArray(issues)) {
        // 想定外のJSON構造では既存Issueの有無を判断しない。
        throw new Error('open Issue一覧が配列ではありません。');
    }

    // タイトルが完全一致する監視Issueだけを更新対象にする。
    const issue = issues.find(({ title }) => title === issueTitle);
    // 整数のIssue番号を取得できた場合だけ既存Issueとして返す。
    return Number.isInteger(issue?.number) ? issue.number : null;
}

// チェック結果をIssueへ記録し、成功時は既存の障害検知Issueをクローズする。
function reportCheck({ actor, checkName, now = () => new Date(), result, runGhCommand = runGh, runUrl, sha }) {
    // cancelledやskippedなど、障害または復旧を表さない結果は処理しない。
    if (!supportedResults.has(result)) {
        // Issue状態を変えずに今回の結果処理を終了する。
        return;
    }

    // チェック名から一意な監視Issueタイトルを組み立てる。
    const issueTitle = `CI: ${checkName}が失敗しています`;
    // 既存Issueがあればコメント更新、なければ新規作成へ分岐する。
    const issueNumber = findOpenIssue(issueTitle, runGhCommand);

    // failureでは障害検知Issueの作成または追記を行う。
    if (result === 'failure') {
        // 発生時点のコミットと実行ログを、再調査に必要な最小情報として記録する。
        const failureMessage = `${checkName}で失敗を検知しました。\n\n- 検知日時: ${formatJstTimestamp(now())}\n- 対象コミット: \`${sha}\`\n- 実行結果: ${result}\n- 実行ログ: ${runUrl}`;

        // 継続中の障害は同じIssueへ追記し、通知先を分散させない。
        if (issueNumber !== null) {
            // 最新の失敗情報を既存Issueの時系列へ追加する。
            runGhCommand(['issue', 'comment', String(issueNumber), '--body', failureMessage]);
            // 新規Issueを作成せず失敗時の処理を終了する。
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
        // 初回障害のIssue作成後は復旧処理へ進まない。
        return;
    }

    // successかつ対応Issueが存在する場合だけ復旧としてクローズする。
    if (issueNumber !== null) {
        // 復旧根拠を残してから、監視Issueをcompletedとして閉じる。
        const recoveryMessage = `${checkName}の成功を確認したため、このIssueをクローズします。\n\n- 復旧確認日時: ${formatJstTimestamp(now())}\n- 対象コミット: \`${sha}\`\n- 実行ログ: ${runUrl}`;
        // 成功した実行情報をクローズ前の最終コメントとして残す。
        runGhCommand(['issue', 'comment', String(issueNumber), '--body', recoveryMessage]);
        // 復旧済みの監視Issueをcompletedとして閉じる。
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
    // Windows固有の結果も別の監視Issueへ反映する。
    reportCheck({ ...context, checkName: 'Weekly Windows script checks', result: env.WINDOWS_RESULT });
}

// workflowから直接実行された場合だけGitHubのIssueを更新する。
if (require.main === module) {
    // 予期しない失敗をworkflowの失敗終了へ変換する。
    try {
        // workflow環境変数に基づくIssue更新を開始する。
        main();
    } catch (error) {
        // 失敗原因をGitHub Actionsログへ簡潔に表示する。
        console.error(`エラー: 定期品質チェック結果を報告できませんでした: ${error.message}`);
        // workflowへ品質チェック結果の報告失敗を通知する。
        process.exitCode = 1;
    }
}

module.exports = { findOpenIssue, formatJstTimestamp, main, reportCheck, runGh };
