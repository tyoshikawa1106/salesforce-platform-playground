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
// エラー本文を使わず、画面名・固定の処理名・例外種別だけを診断用に生成
export function clientErrorDetails(error, operation, phase) {
    // 任意の名前や本文を診断へ混ぜず、通常の例外名だけを採用
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // URLや端末パスを除き、JSファイルの行・列だけを上限付きで抽出
    const frames = typeof error?.stack === 'string'
        ? [...new Set(error.stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8) : [];
    // 値やレコード名を含まない固定の呼び出し位置で表示を構成
    return { location: `accountDataQualityScan.js / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}


// 単一値と配列を共通処理できる配列形式へ正規化
function normalizeToArray(value) {
    // 配列はそのまま使い、単一値だけを配列へ包む
    return Array.isArray(value) ? value : [value];
}

// Salesforceエラーから画面表示用メッセージ一覧を抽出
export function getErrorMessages(errors, fallbackMessage) {
    // 単一エラーと複数エラーを同じ反復処理へ統一
    const normalizedErrors = normalizeToArray(errors);
    // 抽出したメッセージを入力順に保持
    const messages = [];

    // エラー形式ごとに利用可能なメッセージを収集
    for (const error of normalizedErrors) {
        // 空のエラー要素は表示対象から除外
        if (!error) {
            // 後続の形式判定を行わず次のエラーへ進む
            continue;
        }

        // UI APIの複数エラーは1つの表示メッセージへまとめる
        if (Array.isArray(error.body)) {
            // 各bodyのメッセージを入力順に連結
            messages.push(
                error.body.map((bodyError) => bodyError.message).join(', ')
            );
            // 配列形式を単一エラーとして重複処理せず次へ進む
            continue;
        }

        // Apex、JavaScript、代替文言の優先順で表示内容を確定
        messages.push(error.body?.message ?? error.message ?? fallbackMessage);
    }

    // 呼び出し側が用途に応じて整形できる配列を返却
    return messages;
}

// Salesforceエラーを1行の画面表示用文字列へ変換
export function reduceErrors(errors, fallbackMessage) {
    // 複数メッセージを区切り付きで連結
    return getErrorMessages(errors, fallbackMessage).join('; ');
}
