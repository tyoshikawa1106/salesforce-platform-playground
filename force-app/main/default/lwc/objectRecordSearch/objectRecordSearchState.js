// ページング開始位置を1ページ目へ固定
const FIRST_PAGE_NUMBER = 1;

// 1回の検索で取得する既定件数
export const DEFAULT_PAGE_SIZE = 50;
// Name相当列を示す既定の画面列キー
export const DEFAULT_SORTED_BY = 'recordUrl';
// 初期表示を昇順で統一
export const DEFAULT_SORT_DIRECTION = 'asc';

// 新しい検索条件に使う初期ページング状態を生成
export function createInitialPaginationState() {
    // 履歴と次ページ情報を持たない1ページ目を返却
    return {
        // 初期ページ番号を設定
        pageNumber: FIRST_PAGE_NUMBER,
        // 既定の取得件数を設定
        pageSize: DEFAULT_PAGE_SIZE,
        // 1ページ目には入力トークンを設定しない
        currentPageToken: undefined,
        // 応答受信前は次ページトークンを設定しない
        nextPageToken: undefined,
        // 前ページへ戻るためのトークン履歴を初期化
        pageTokenHistory: [],
        // 応答受信前は次ページなしとして扱う
        hasNextPage: false
    };
}

// Apex応答を画面で保持するページング状態へ変換
export function createPaginationStateFromResponse(data, currentPageSize) {
    // 応答値を優先し、不足値には現在値または既定値を補完
    return {
        // 応答にページ番号がない場合は1ページ目として扱う
        pageNumber: data.pageNumber ?? FIRST_PAGE_NUMBER,
        // 応答、現在値、既定値の順で取得件数を決定
        pageSize: data.pageSize ?? currentPageSize ?? DEFAULT_PAGE_SIZE,
        // 次回検索に使うページトークンを保持
        nextPageToken: data.nextPageToken,
        // Apex応答を真偽値へ正規化
        hasNextPage: Boolean(data.hasNextPage)
    };
}

// 1つ前の検索境界へ戻すページング状態を生成
export function createPreviousPageState({ pageNumber, pageTokenHistory }) {
    // 現在ページへ進む際に追加した末尾トークンを除外
    const previousHistory = pageTokenHistory.slice(0, -1);
    // 前ページ番号と対応する検索境界を返却
    return {
        // 表示ページを1つ戻す
        pageNumber: pageNumber - 1,
        // 残った履歴の末尾を前ページの入力トークンに設定
        currentPageToken: previousHistory[previousHistory.length - 1],
        // 更新済み履歴を次回操作へ引き継ぐ
        pageTokenHistory: previousHistory
    };
}

// 応答の次ページ境界へ進むページング状態を生成
export function createNextPageState({
    pageNumber,
    pageTokenHistory,
    nextPageToken
}) {
    // 次ページ番号と新しい検索境界を返却
    return {
        // 表示ページを1つ進める
        pageNumber: pageNumber + 1,
        // Apex応答のトークンを次回検索へ使用
        currentPageToken: nextPageToken,
        // 前ページへ戻れるよう使用済みトークンを履歴へ追加
        pageTokenHistory: [...pageTokenHistory, nextPageToken]
    };
}

// datatableから受け取るソート方向をApex許可値へ正規化
export function normalizeSortDirection(sortDirection) {
    // descだけを降順とし、それ以外は安全な昇順へ統一
    return sortDirection === 'desc' ? 'desc' : 'asc';
}

// 権限とフォーム対応状況から利用者向け案内を生成
export function createAccessMessages({
    config,
    formCapabilityMessage,
    isFileUploadObject,
    isRecordFormObject,
    shouldShowFormFieldMessage,
    hasFormLayoutError
}) {
    // 検索設定取得前は案内を表示しない
    if (!config) {
        // 表示項目なしの状態を空配列で返却
        return [];
    }

    // 表示順を保つ案内一覧を初期化
    const messages = [];
    // API名ではなく画面表示ラベルを案内文へ使用
    const objectLabel = config.objectLabel ?? 'レコード';
    // オブジェクト固有のフォーム対応状況を先頭へ追加
    addMessage(messages, 'form-capability', formCapabilityMessage);

    // Name相当項目を検索できない場合に制約を通知
    if (!config.searchable) {
        // 検索機能を使えない理由を追加
        addMessage(
            messages,
            'searchable',
            `${objectLabel}の検索対象項目を参照できないため、検索条件を使えません。`
        );
    }

    // ファイルアップロード以外で作成権限がない場合に通知
    if (!config.createable && !isFileUploadObject) {
        // 新規作成を使えない理由を追加
        addMessage(
            messages,
            'createable',
            `${objectLabel}を作成する権限がありません。`
        );
    }

    // 標準フォーム対象で更新権限がない場合に通知
    if (!config.updateable && isRecordFormObject) {
        // 編集操作を使えない理由を追加
        addMessage(
            messages,
            'updateable',
            `${objectLabel}を編集する権限がありません。`
        );
    }

    // 削除権限がない場合に操作制約を通知
    if (!config.deletable) {
        // 一括削除を使えない理由を追加
        addMessage(
            messages,
            'deletable',
            `${objectLabel}を削除する権限がありません。`
        );
    }

    // 作成と編集に使える項目がない場合に通知
    if (shouldShowFormFieldMessage) {
        // 入力フォームを表示できない理由を追加
        addMessage(
            messages,
            'form-fields',
            `${objectLabel}の作成・編集に使える標準項目がありません。`
        );
    }

    // レイアウト取得失敗時に代替フォーム使用を通知
    if (hasFormLayoutError && isRecordFormObject) {
        // 標準項目へ切り替わった状態を追加
        addMessage(
            messages,
            'layout-fallback',
            'ページレイアウトを取得できないため、標準の入力項目で表示します。'
        );
    }

    // 表示条件を満たした案内だけを返却
    return messages;
}

// 空文字を除外して案内一覧へ項目を追加
function addMessage(messages, key, message) {
    // 表示内容がある場合だけテンプレート用項目を作成
    if (message) {
        // 繰り返し描画用キーと本文を保持
        messages.push({ key, message });
    }
}
