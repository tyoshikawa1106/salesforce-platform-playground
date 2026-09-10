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
