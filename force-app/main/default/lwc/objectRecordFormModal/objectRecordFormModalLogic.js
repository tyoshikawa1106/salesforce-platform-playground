import { createLogDetails } from 'c/lwcLoggerUtils';
// 保存とアップロードの結果を親の成功通知へ変換
export function createCompletionResult({ recordId, objectLabel, files }) {
    // アップロードは登録されたファイル件数を通知
    if (files) {
        return { title: 'アップロードしました', message: `${files.length} 件のファイルを登録しました。` };
    }
    // レコードIDの有無から新規作成と既存更新を区別
    return {
        title: recordId ? '更新しました' : '作成しました',
        message: `${objectLabel}を保存しました。`
    };
}

// 詳細がない保存エラーにも操作対象を含む案内を生成
export function createSaveError(detail, objectLabel) {
    return detail?.message ?? `${objectLabel}を保存できませんでした。`;
}
// エラー本文を使わず、画面名・固定の処理名・例外種別だけを診断用に生成
export function clientErrorDetails(error, operation, phase) {
    // 例外の種類とSalesforce応答形式の判定はこの画面で管理
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // 判定済みの種類と固定位置だけを共通のログ整形へ渡す
    return createLogDetails({ source: 'objectRecordFormModal.js', operation, phase, errorType, stack: error?.stack });
}