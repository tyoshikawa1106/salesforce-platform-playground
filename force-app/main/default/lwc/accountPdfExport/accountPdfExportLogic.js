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
    // 任意の名前や本文を診断へ混ぜず、通常の例外名だけを採用
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // URLや端末パスを除き、JSファイルの行・列だけを上限付きで抽出
    const frames = typeof error?.stack === 'string'
        ? [...new Set(error.stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8) : [];
    // 値やレコード名を含まない固定の呼び出し位置で表示を構成
    return { location: `accountPdfExport.js / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}
