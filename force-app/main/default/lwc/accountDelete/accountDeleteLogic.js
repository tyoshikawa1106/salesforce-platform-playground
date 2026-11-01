// ジョブ状態を画面の日本語表示へ対応付け
const STATUS_LABELS = {
    Holding: '保留中',
    Queued: '待機中',
    Preparing: '準備中',
    Processing: '進行中',
    Completed: '完了',
    PartialFailure: '一部失敗',
    Failed: '異常終了',
    Aborted: '中断',
    Rejected: '開始拒否'
};
// 確定結果を持つ状態だけを再実行可能とする
const TERMINAL_STATUSES = new Set(['Completed', 'PartialFailure', 'Failed', 'Aborted', 'Rejected']);

// 権限、受付状態、ジョブを一つの表示モデルへ変換
export function createDeleteView(response, isBusy, acceptedJobId) {
    // ジョブがない場合をIDの有無で判定
    const run = response?.latestJob?.Id ? response.latestJob : undefined;
    // 権限不足の応答から過去の結果を表示しない
    const blockMessage = response?.blockMessage || '';
    // 確定した終端状態だけを完了とする
    const completed = Boolean(run && TERMINAL_STATUSES.has(run.Status));
    // 受付直後は同じジョブの終端確認まで新規開始を抑止
    const acceptedJobCompleted = Boolean(acceptedJobId && run?.Id === acceptedJobId && completed);
    // 受付したジョブと異なる履歴を今回の処理状態として表示しない
    const belongsToCurrentView = acceptedJobId ? run?.Id === acceptedJobId : !completed;
    const displayedRun = belongsToCurrentView ? run : undefined;
    // 受付応答では待機中と表示し、取得失敗では状態を断定しない
    const acceptedStatus = response?.jobId === acceptedJobId && acceptedJobId ? '待機中' : '状態未確認';
    // 処理・通知結果を読みやすい表示へ整形
    return {
        blockMessage,
        canStart: Boolean(
            response && !isBusy && !blockMessage && (!run || completed) && (!acceptedJobId || acceptedJobCompleted)
        ),
        acceptedJobCompleted,
        hasRun: Boolean((displayedRun || acceptedJobId) && !blockMessage),
        status: STATUS_LABELS[displayedRun?.Status] || acceptedStatus,
        jobId: blockMessage ? '' : acceptedJobId || displayedRun?.Id || '',
        message: response?.message || ''
    };
}
// エラー本文を使わず、画面名・固定の処理名・例外種別だけを診断用に生成
export function clientErrorDetails(error, operation, phase) {
    // 任意の名前や本文を診断へ混ぜず、通常の例外名だけを採用
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // URLや端末パスを除き、JSファイルの行・列だけを上限付きで抽出
    const frames = typeof error?.stack === 'string'
        ? [...new Set(error.stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8) : [];
    // 値やレコード名を含まない固定の呼び出し位置で表示を構成
    return { location: `accountDelete.js / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}