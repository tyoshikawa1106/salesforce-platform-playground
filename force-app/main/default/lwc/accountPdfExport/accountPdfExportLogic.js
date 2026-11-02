import { createLogDetails } from 'c/lwcLoggerUtils';
const ACCOUNT_ID_PATTERN = /^001[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/;

export const isAccountRecordId = (recordId) =>
    ACCOUNT_ID_PATTERN.test(recordId || '');

export const createPdfPageReference = (recordId) => ({
    type: 'standard__webPage',
    attributes: {
        url: `/apex/AccountPdf?accountId=${encodeURIComponent(recordId)}`
    }
});
// エラー本文を使わず、画面名・固定の処理名・例外種別だけを診断用に生成
export function clientErrorDetails(error, operation, phase) {
    // 例外の種類とSalesforce応答形式の判定はこの画面で管理
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // 判定済みの種類と固定位置だけを共通のログ整形へ渡す
    return createLogDetails({ source: 'accountPdfExport.js', operation, phase, errorType, stack: error?.stack });
}