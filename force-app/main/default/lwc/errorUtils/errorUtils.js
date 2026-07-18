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

// トーストへ表示する複数メッセージを改行区切りで整形
export function createToastMessage(messages, fallbackMessage) {
    // 単一メッセージと複数メッセージを同じ絞り込み処理へ統一
    const normalizedMessages = normalizeToArray(messages);
    // 空のメッセージをトースト表示から除外
    const displayMessages = normalizedMessages.filter((message) =>
        Boolean(message)
    );

    // 有効な内容がない場合だけ代替メッセージを返却
    return displayMessages.length > 0
        ? displayMessages.join('\n')
        : fallbackMessage;
}
