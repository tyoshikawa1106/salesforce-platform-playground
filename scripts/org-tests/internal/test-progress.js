// 実行方法: test-runner.jsとテストスクリプトから読み込む。
// 用途: 組織テストのSalesforce CLI応答、進捗取得、利用者向け表示を共通処理する。

// 組織テスト全体の処理が終了したと判断できるステータス。
const finishedStatuses = new Set(['Aborted', 'Completed', 'Failed', 'Passed', 'Skipped']);

// CLIの英語ステータスを利用者向けの日本語へ変換する。
const statusLabels = Object.freeze({
    Aborted: '中止',
    Completed: '完了',
    Failed: '失敗',
    Passed: '完了',
    Processing: '実行中',
    Queued: '待機中',
    Skipped: 'スキップ'
});

// Salesforce CLIの実行結果をJSONとして検証する。
function parseSfJson(result, operation) {
    // CLIプロセスを開始できない場合は応答解析へ進まない。
    if (result.error) {
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    // JSON本文のstatusとmessageを確認できるよう応答を解析する。
    let parsed;

    try {
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    // CLIまたはJSON本文のどちらかが失敗なら、同じ操作エラーとして扱う。
    if (result.status !== 0 || parsed.status !== 0) {
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        throw new Error(`${operation}に失敗しました${detail}`);
    }

    return parsed.result;
}

// 進捗をTTYでは同じ行へ、それ以外では行単位で表示する。
function createProgressReporter({ stdout = process.stdout, writeLine = console.log } = {}) {
    // TTY上で短い表示へ更新したとき、前回分を空白で消すため長さを保持する。
    let previousLength = 0;

    function write(message, endOfLine) {
        // CIなど非TTYでは履歴が残るよう、更新ごとに改行して出力する。
        if (!stdout.isTTY) {
            writeLine(message);
            return;
        }

        // 前回より短いメッセージでも末尾が画面に残らないよう空白を補う。
        const padding = ' '.repeat(Math.max(0, previousLength - message.length));
        // 終了時だけ改行し、進捗更新中は同じ行を上書きする。
        stdout.write(`\r${message}${padding}${endOfLine ? '\n' : ''}`);
        // 改行後は次の表示を新しい行として扱う。
        previousLength = endOfLine ? 0 : message.length;
    }

    return {
        finish(message) {
            write(message, true);
        },
        update(message) {
            write(message, false);
        }
    };
}

// テストランのクラス単位の進捗をTooling APIから取得する。
function getTestRunProgress({ repoRoot, runSfWithOutputCommand, targetOrg, testRunId }) {
    // 開始した非同期jobに対応するApexTestRunResultだけを取得する。
    const query =
        `SELECT Status, ClassesCompleted, ClassesEnqueued ` +
        `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;
    // Tooling APIのJSON応答からテストラン結果を取り出す。
    const result = parseSfJson(
        runSfWithOutputCommand(
            ['data', 'query', '--use-tooling-api', '--query', query, '--target-org', targetOrg, '--json'],
            repoRoot
        ),
        '組織テスト進捗の取得'
    );

    // records配列がない応答は進捗未作成と区別して失敗にする。
    if (!result || !Array.isArray(result.records)) {
        throw new Error('組織テスト進捗の応答にrecordsがありません。');
    }

    // 開始直後にレコードが未作成の場合はキュー登録中として扱う。
    if (result.records.length === 0) {
        return null;
    }

    // 同じjob IDへ複数レコードが返る不整合を推測で選択しない。
    if (result.records.length !== 1) {
        throw new Error('組織テスト進捗を一意に取得できませんでした。');
    }

    // 一意に取得した進捗レコードを型検証へ渡す。
    const [progress] = result.records;

    if (
        typeof progress.Status !== 'string' ||
        !Number.isInteger(progress.ClassesCompleted) ||
        !Number.isInteger(progress.ClassesEnqueued)
    ) {
        throw new Error('組織テスト進捗に必要な項目がありません。');
    }

    return progress;
}

// 取得した進捗を表示メッセージと終了判定へ変換する。
function describeTestRunProgress(progress) {
    // レコード作成前は終了とみなさず、キュー登録中を表示する。
    if (progress === null) {
        return { finished: false, message: '進捗: キュー登録中' };
    }

    // 未知の新規ステータスは英語値を残し、状態を隠さない。
    const statusLabel = statusLabels[progress.Status] ?? progress.Status;
    return {
        finished: finishedStatuses.has(progress.Status),
        message: `進捗: ${progress.ClassesCompleted} / ${progress.ClassesEnqueued}件完了（${statusLabel}）`
    };
}

module.exports = {
    createProgressReporter,
    describeTestRunProgress,
    getTestRunProgress,
    parseSfJson
};
