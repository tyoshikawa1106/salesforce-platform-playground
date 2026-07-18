// 初期取得と追加取得で共通する利用者向けエラー文言
export const LOAD_ERROR_MESSAGE =
    'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。';

// 1件以上のメールを表示できるか判定
export function hasEmailMessages(emailMessages = []) {
    // 一覧の要素数をテンプレート用真偽値へ変換
    return emailMessages.length > 0;
}

// 初期取得状態と総件数からカードタイトルを生成
export function createCardTitle({ hasLoaded, errorMessage, totalCount }) {
    // 初期取得前とエラー時は不確かな件数を表示しない
    if (!hasLoaded || errorMessage) {
        // 件数を含まない固定タイトルを返却
        return 'メールログ';
    }
    // 取得成功後はCase全体のメール件数を表示
    return `メールログ (${totalCount})`;
}

// wire応答から初期ページの取得完了状態を判定
export function hasInitialPageLoaded(wiredResult) {
    // 成功または失敗のどちらかを受信済みなら完了扱い
    return Boolean(wiredResult?.data || wiredResult?.error);
}

// wire応答と明示エラーから初期ローディング状態を判定
export function isInitialLoading({ errorMessage, wiredResult }) {
    // データ、エラー、明示エラーのいずれもない間だけ読込中とする
    return Boolean(
        !errorMessage && !wiredResult?.data && !wiredResult?.error
    );
}

// EmailMessageレコードをテンプレート表示用の行へ変換
export function createDisplayRow(emailMessage) {
    // Incomingフラグを日本語の送受信区分へ変換
    const direction = emailMessage.Incoming ? '受信' : '送信';
    // 送受信区分に対応するLightningアイコンを選択
    const directionIconName = emailMessage.Incoming
        ? 'utility:email_open'
        : 'utility:sender_email';
    // 差出人未設定時もリンクラベルを空にしない
    const fromAddress = emailMessage.FromAddress || '(差出人なし)';
    // 宛先未設定時も表示内容を空にしない
    const toAddress = emailMessage.ToAddress || '(宛先なし)';

    // 表示、リンク、アクセシビリティ用の値をまとめて返却
    return {
        // 繰り返し描画のキーにEmailMessage IDを使用
        id: emailMessage.Id,
        // テキスト本文がない場合は代替表示を使用
        body: emailMessage.TextBody || '(本文なし)',
        // 日本語の送受信区分を表示
        direction,
        // 送受信区分に対応するアイコン名を設定
        directionIconName,
        // 詳細領域のaria参照IDを生成
        detailsId: `email-message-details-${emailMessage.Id}`,
        // 整形済み差出人を表示
        fromAddress,
        // 差出人を宛先にしたメールリンクを生成
        fromAddressUrl: `mailto:${encodeURIComponent(fromAddress)}`,
        // メッセージ見出しのaria参照IDを生成
        headingId: `email-message-${emailMessage.Id}`,
        // Salesforceの送受信日時を保持
        messageDate: emailMessage.MessageDate,
        // EmailMessage標準詳細ページの相対URLを生成
        recordUrl: `/lightning/r/EmailMessage/${emailMessage.Id}/view`,
        // 件名未設定時もカードを識別できる代替表示を使用
        subject: emailMessage.Subject || '(件名なし)',
        // 差出人、宛先、送受信区分を要約文へ統合
        summary: `${fromAddress} から ${toAddress} への${direction}メール`,
        // 要約領域のaria参照IDを生成
        summaryId: `email-message-summary-${emailMessage.Id}`,
        // 整形済み宛先を表示
        toAddress,
        // 宛先を宛先にしたメールリンクを生成
        toAddressUrl: `mailto:${encodeURIComponent(toAddress)}`
    };
}

// 初期ページ応答から一覧とページング状態を生成
export function createInitialPageState(page, totalCount) {
    // 各EmailMessageをテンプレート表示行へ変換
    const emailMessages = (page.emailMessages || []).map(createDisplayRow);
    // 次ページ情報を含む初期表示状態を返却
    return {
        // 初期ページの表示行を保持
        emailMessages,
        // 次回取得に使うApexページトークンを保持
        nextPageToken: page.nextPageToken,
        // 総件数と取得済み件数から次ページ有無を判定
        hasNextPage: canLoadNextPage({
            // Apexが返した次ページ境界を渡す
            nextPageToken: page.nextPageToken,
            // 初期ページの取得済み件数を渡す
            loadedCount: emailMessages.length,
            // COUNTで取得した総件数を渡す
            totalCount
        }),
        // 初期ページ成功時は以前の追加取得エラーを解除
        loadMoreErrorMessage: undefined
    };
}

// 追加ページ応答から既存一覧へ連結する次状態を生成
export function createNextPageState({ page, emailMessages, totalCount }) {
    // 追加ページを表示行へ変換して先頭行へ区切り情報を付加
    const nextEmailMessages = createNextPageDisplayRows(
        page,
        emailMessages.length
    );
    // 既存順を保って新しい表示行を末尾へ追加
    const combinedEmailMessages = [...emailMessages, ...nextEmailMessages];
    // 追加後の一覧とページング状態を返却
    return {
        // 結合済みの表示行を保持
        emailMessages: combinedEmailMessages,
        // 続く追加取得へ使うトークンを保持
        nextPageToken: page.nextPageToken,
        // 総件数と取得済み件数から追加取得可否を再判定
        hasNextPage: canLoadNextPage({
            // Apexが返した次ページ境界を渡す
            nextPageToken: page.nextPageToken,
            // 追加後の取得済み件数を渡す
            loadedCount: combinedEmailMessages.length,
            // COUNTで取得した総件数を渡す
            totalCount
        })
    };
}

// 一覧と次ページ情報を未取得状態へ初期化
export function createEmptyPaginationState() {
    // 古い一覧とページ境界を持たない状態を返却
    return {
        // 以前取得したメール一覧を破棄
        emailMessages: [],
        // 追加取得ボタンを無効化
        hasNextPage: false,
        // 古いページトークンを破棄
        nextPageToken: undefined
    };
}

// 次ページトークンと未取得件数から追加取得可否を判定
function canLoadNextPage({ nextPageToken, loadedCount, totalCount }) {
    // トークンがあり取得済み件数が総件数未満の場合だけ有効化
    return Boolean(nextPageToken && loadedCount < totalCount);
}

// 追加ページを表示行へ変換して先頭行へ区切り情報を付加
function createNextPageDisplayRows(page, loadedCount) {
    // 追加前の件数から新しいページの開始位置を計算
    const rangeStart = loadedCount + 1;
    // Apex応答を既存行と同じ表示構造へ変換
    const nextEmailMessages = (page.emailMessages || []).map(createDisplayRow);
    // 空ページでは区切り行を作らずそのまま返却
    if (nextEmailMessages.length === 0) {
        // 空の表示行一覧を呼び出し側へ返却
        return nextEmailMessages;
    }

    // 新しいページの最終表示位置を計算
    const rangeEnd = rangeStart + nextEmailMessages.length - 1;
    // 追加ページ先頭行へスクリーンリーダー用区切りを追加
    nextEmailMessages[0] = {
        ...nextEmailMessages[0],
        // テンプレートへページ区切り表示を通知
        hasPageSeparator: true,
        // aria参照に使う一意な区切りIDを生成
        pageSeparatorId: `email-page-separator-${rangeStart}-${rangeEnd}`,
        // 読み込んだ表示範囲を支援技術へ通知
        pageSeparatorMessage: `${rangeStart}件目から${rangeEnd}件目を読み込みました`
    };
    // 区切り情報を含む追加表示行を返却
    return nextEmailMessages;
}
