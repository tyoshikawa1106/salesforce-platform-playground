// 受付ジョブの状態と全体の残存確認を区別して表示
const STATUS_LABELS = {
    Holding: '保留中',
    Queued: '待機中',
    Preparing: '準備中',
    Processing: '処理中',
    Completed: '受付ジョブ終了',
    Failed: '受付ジョブ失敗',
    Aborted: '受付ジョブ中断'
};

// 固定順序、対象外の機能、取得できた件数を画面行へまとめる
export function createRows(response, counts) {
    // 未取得の件数をゼロと表示しない
    return (response?.objectNames || []).map((name, index) => {
        // 機能がない場合と照会に失敗した場合を区別
        const unavailable = response.unavailableObjects?.includes(name);
        // 確認済みの数値だけを件数として扱う
        const count = counts[name];
        // 表示と実行可否の判定に同じ確認状態を使用
        return {
            name,
            order: index + 1,
            label: response.labels?.[name] || name,
            remaining: unavailable ? '対象外（機能なし）' : Number.isInteger(count) ? String(count) : '未確認',
            known: unavailable || Number.isInteger(count),
            empty: unavailable || count === 0
        };
    });
}

// 権限・通信・受付状況から開始可否と結果案内を生成
export function createView(response, counts, busy, acceptedJobId, acceptanceUnknown) {
    // 複数箇所で残存状態の判定を重複させない
    const rows = createRows(response, counts);
    // 全対象の最新件数が必要
    const allKnown = rows.length > 0 && rows.every((row) => row.known);
    // 正常な標準ジョブ終了だけでは削除完了と判定しない
    const empty = allKnown && rows.every((row) => row.empty);
    // 追跡中のジョブと一致する応答だけを表示
    const job = response?.jobs?.find((entry) => entry.Id === acceptedJobId);
    // 受付応答の欠落時は以前の成功結果から開始を許可しない
    const tracked = !acceptedJobId || Boolean(job);
    // 完了表示は現在の全件確認を根拠にする
    return {
        rows,
        organizationName: response?.organizationName || '',
        canStart: Boolean(
            response &&
            !response.errorMessage &&
            !busy &&
            response.executionState !== 'RUNNING' &&
            !acceptanceUnknown &&
            tracked &&
            allKnown &&
            !empty
        ),
        blockMessage: response?.errorMessage || '',
        status: acceptanceUnknown
            ? '受付不明'
            : response?.executionState === 'RUNNING'
              ? '削除処理中'
              : empty
                ? '対象レコードなし（残件数確認済み）'
                : allKnown && job && ['Completed', 'Failed', 'Aborted'].includes(job.Status)
                  ? '削除停止・残件数あり'
                  : allKnown
                    ? '対象レコードあり'
                    : '状態未確認',
        jobStatus: job
            ? job.NumberOfErrors > 0
                ? '受付ジョブにエラーあり'
                : STATUS_LABELS[job.Status] || '状態未確認'
            : acceptedJobId
              ? '受付ジョブ確認中'
              : '',
        allKnown
    };
}

// 組織で有効な固定対象だけを残件数照会へ渡す
export function getAvailableObjectNames(response) {
    // optional objectの欠落を照会失敗へ変換しない
    return response.objectNames.filter((name) => !response.unavailableObjects.includes(name));
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
    return { location: `testDataDelete.js / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}