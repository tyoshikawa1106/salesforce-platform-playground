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
        // 対象操作名とspawnエラーを保持して呼び出し元へ返す。
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    // JSON本文のstatusとmessageを確認できるよう応答を解析する。
    let parsed;

    // 不正なJSONを成功結果として扱わないよう解析エラーを捕捉する。
    try {
        // 空の標準出力も解析エラーとして検出できる文字列へ揃える。
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        // 元の解析エラーを含め、応答形式の問題を明示する。
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    // CLIまたはJSON本文のどちらかが失敗なら、同じ操作エラーとして扱う。
    if (result.status !== 0 || parsed.status !== 0) {
        // CLIが返したmessageがある場合だけ診断情報へ追加する。
        const detail = typeof parsed.message === 'string' ? `: ${parsed.message}` : '';
        // 対象操作名を含む共通エラーとして呼び出し元へ返す。
        throw new Error(`${operation}に失敗しました${detail}`);
    }

    // CLI固有の外側構造を除き、進捗取得に必要なresultだけを返す。
    return parsed.result;
}

// 進捗をTTYでは同じ行へ、それ以外では行単位で表示する。
function createProgressReporter({ stdout = process.stdout, writeLine = console.log } = {}) {
    // TTY上で短い表示へ更新したとき、前回分を空白で消すため長さを保持する。
    let previousLength = 0;

    // 出力先の種別に応じて進捗の更新または確定を行う。
    function write(message, endOfLine) {
        // CIなど非TTYでは履歴が残るよう、更新ごとに改行して出力する。
        if (!stdout.isTTY) {
            // 注入された行出力関数へ現在の進捗を渡す。
            writeLine(message);
            // 非TTYで同じ進捗を重複出力しないよう、この分岐で完結させる。
            return;
        }

        // 前回より短いメッセージでも末尾が画面に残らないよう空白を補う。
        const padding = ' '.repeat(Math.max(0, previousLength - message.length));
        // 終了時だけ改行し、進捗更新中は同じ行を上書きする。
        stdout.write(`\r${message}${padding}${endOfLine ? '\n' : ''}`);
        // 改行後は次の表示を新しい行として扱う。
        previousLength = endOfLine ? 0 : message.length;
    }

    // 呼び出し元へ更新中と完了時の2つの表示操作を提供する。
    return {
        finish(message) {
            // 後続ログが進捗表示と同じ行へ重ならないよう改行を確定する。
            write(message, true);
        },
        update(message) {
            // TTYでpollごとの履歴を増やさない更新方法を使用する。
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
        // 応答構造の不備をキュー待ちとして扱わない。
        throw new Error('組織テスト進捗の応答にrecordsがありません。');
    }

    // 開始直後にレコードが未作成の場合はキュー登録中として扱う。
    if (result.records.length === 0) {
        // 呼び出し元が未作成状態を表示へ変換できるnullを返す。
        return null;
    }

    // 同じjob IDへ複数レコードが返る不整合を推測で選択しない。
    if (result.records.length !== 1) {
        // 曖昧な進捗レコードから状態を推測せず停止する。
        throw new Error('組織テスト進捗を一意に取得できませんでした。');
    }

    // 一意に取得した進捗レコードを型検証へ渡す。
    const [progress] = result.records;

    // 表示と終了判定に必要なstatusと件数の型を確認する。
    if (
        typeof progress.Status !== 'string' ||
        !Number.isInteger(progress.ClassesCompleted) ||
        !Number.isInteger(progress.ClassesEnqueued)
    ) {
        // 不完全なレコードを進捗として使用しない。
        throw new Error('組織テスト進捗に必要な項目がありません。');
    }

    // 型検証済みの進捗レコードを呼び出し元へ返す。
    return progress;
}

// 取得した進捗を表示メッセージと終了判定へ変換する。
function describeTestRunProgress(progress) {
    // レコード作成前は終了とみなさず、キュー登録中を表示する。
    if (progress === null) {
        // 未完了判定と利用者向けメッセージをまとめて返す。
        return { finished: false, message: '進捗: キュー登録中' };
    }

    // 未知の新規ステータスは英語値を残し、状態を隠さない。
    const statusLabel = statusLabels[progress.Status] ?? progress.Status;
    // 完了判定とクラス件数を含む表示メッセージを返す。
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
