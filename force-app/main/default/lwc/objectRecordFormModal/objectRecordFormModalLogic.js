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
    // 任意の名前や本文を診断へ混ぜず、通常の例外名だけを採用
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // URLや端末パスを除き、JSファイルの行・列だけを上限付きで抽出
    const frames = typeof error?.stack === 'string'
        ? [...new Set(error.stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8) : [];
    // 値やレコード名を含まない固定の呼び出し位置で表示を構成
    return { location: `objectRecordFormModal.js / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}