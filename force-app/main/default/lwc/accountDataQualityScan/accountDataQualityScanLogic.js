// Apex状態値に対応する日本語表示
const STATUS_LABELS = Object.freeze({
    // Queueable登録直後の待機状態
    Pending: '待機中',
    // Cursor分割処理の継続状態
    Running: '処理中',
    // 全取得位置の処理完了状態
    Completed: '完了',
    // 処理を継続できない失敗状態
    Failed: '失敗'
});
// 新しい開始を拒否する状態値
const ACTIVE_STATUSES = new Set(['Pending', 'Running']);

// Apex応答を画面表示と操作判定に必要な値へ変換
export function createScanViewModel(scan, isBusy = false) {
    // 履歴がない場合は結果領域を生成しない
    if (!scan) {
        // 操作中でない初期状態だけ開始可能にする最小モデルを返さない
        return null;
    }

    // 状態値を表示ラベルと操作可否へ使える形式に正規化
    const status = scan.status ?? 'Unknown';
    // 待機中または処理中か判定
    const isActive = ACTIVE_STATUSES.has(status);
    // 画面で扱う進捗率を0から100へ制限
    const progressPercent = Math.min(
        Math.max(Number(scan.progressPercent ?? 0), 0),
        100
    );

    // テンプレートで直接参照できる表示モデルを返却
    return {
        // 管理レコードの安定IDを保持
        scanId: scan.scanId,
        // Apexの状態値を保持
        status,
        // 未知状態も識別できる表示名へ変換
        statusLabel: STATUS_LABELS[status] ?? status,
        // 対象総件数を数値へ正規化
        totalCount: Number(scan.totalCount ?? 0),
        // 処理済み件数を数値へ正規化
        processedCount: Number(scan.processedCount ?? 0),
        // 進捗バーへ渡す範囲内の値を保持
        progressPercent,
        // 電話番号不足件数を数値へ正規化
        missingPhoneCount: Number(scan.missingPhoneCount ?? 0),
        // 業種不足件数を数値へ正規化
        missingIndustryCount: Number(scan.missingIndustryCount ?? 0),
        // 請求先住所不足件数を数値へ正規化
        missingAddressCount: Number(scan.missingAddressCount ?? 0),
        // Webサイト不足件数を数値へ正規化
        missingWebsiteCount: Number(scan.missingWebsiteCount ?? 0),
        // 取引先番号不足件数を数値へ正規化
        missingAccountNumberCount: Number(
            scan.missingAccountNumberCount ?? 0
        ),
        // 開始日時を表示用に保持
        startedAt: scan.startedAt,
        // 終了日時を表示用に保持
        completedAt: scan.completedAt,
        // 失敗時の安全なエラー文言を保持
        errorMessage: scan.errorMessage,
        // 実行状態と画面操作中状態から開始可否を決定
        canStart: !isActive && !isBusy,
        // 待機中または処理中の表示切り替えに使う
        isActive,
        // 失敗文言の表示要否を決定
        hasError: Boolean(scan.errorMessage)
    };
}
