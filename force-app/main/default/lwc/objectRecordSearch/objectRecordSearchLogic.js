import { reduceErrors } from 'c/errorUtils';
import {
    createColumns,
    createDisplayRow,
    getSortFieldApiName
} from './objectRecordSearchDisplay';
import {
    DEFAULT_SORT_DIRECTION,
    DEFAULT_SORTED_BY,
    createAccessMessages,
    createInitialPaginationState,
    createNextPageState,
    createPaginationStateFromResponse,
    createPreviousPageState,
    normalizeSortDirection
} from './objectRecordSearchState';
import {
    FORM_MODE_FILE_UPLOAD,
    FORM_MODE_RECORD,
    applyFormFieldOverrides,
    createFallbackFormSections,
    createLayoutFormSections,
    getCurrentLayout,
    getObjectUiCapability
} from './objectRecordSearchForm';

export {
    DEFAULT_SORT_DIRECTION,
    DEFAULT_SORTED_BY,
    FORM_MODE_FILE_UPLOAD,
    FORM_MODE_RECORD,
    applyFormFieldOverrides,
    createAccessMessages,
    createColumns,
    createFallbackFormSections,
    createInitialPaginationState,
    createLayoutFormSections,
    createNextPageState,
    createPreviousPageState,
    getCurrentLayout,
    getObjectUiCapability,
    normalizeSortDirection
};

// 現在の画面状態からApex検索要求を生成
export function createSearchRequest({
    metricKey,
    searchTerm,
    currentPageToken,
    sortedBy,
    sortedDirection,
    pageNumber,
    config
}) {
    // datatable列キーをApex検索用の項目API名へ変換
    const sortBy = getSortFieldApiName({
        // 現在選択中のdatatable列キーを渡す
        sortedBy,
        // 設定取得前は標準Name項目へフォールバック
        nameFieldApiName: config?.nameFieldApiName ?? 'Name'
    });
    // Apex Wrapperの入力項目に現在状態を対応付ける
    return {
        // 許可リスト解決に使うカタログキーを指定
        metricKey,
        // 確定済み検索語だけを送信
        searchTerm,
        // 現在ページのカーソル境界を指定
        pageToken: currentPageToken,
        // datatable列キーから解決した項目API名を指定
        sortBy,
        // 許可値へ正規化済みのソート方向を指定
        sortDirection: sortedDirection,
        // 応答表示と整合する現在ページ番号を指定
        pageNumber
    };
}

// Apex検索成功応答を画面へ反映する状態へ変換
export function createSearchSuccessState(data, currentPageSize) {
    // 対象オブジェクトの権限と表示設定を取得
    const config = data.config;
    // Apex Wrapperをdatatable用の平坦な行へ変換
    const rows = (data.records ?? []).map((record) =>
        createDisplayRow(record, config?.displayFields)
    );
    // Apex応答のページ情報を画面状態へ変換
    const paginationState = createPaginationStateFromResponse(
        data,
        currentPageSize
    );
    // 一覧、ページング、エラー解除を1つの状態として返却
    return {
        // 対象オブジェクトの設定を保持
        config,
        // datatable表示行を保持
        rows,
        // ページ番号、件数、次ページ境界を展開
        ...paginationState,
        // ページ切り替え後に以前の選択を解除
        selectedRowIds: [],
        // 再取得成功時は以前のエラー見出しを解除
        errorTitle: undefined,
        // 再取得成功時は以前のエラー本文を解除
        errorMessage: undefined
    };
}

// Apex検索失敗応答を画面エラー状態へ変換
export function createSearchFailureState(error) {
    // 権限エラーと一般エラーで利用者の次操作を分ける
    const errorTitle = isAccessError(error)
        ? 'アクセス権限を確認してください'
        : 'レコード一覧を読み込めませんでした';
    // Salesforceエラーを利用者向け文言へ変換
    const errorMessage = reduceErrors(
        error,
        'レコード一覧を読み込めませんでした。'
    );
    // 古い一覧とページ情報を残さないエラー状態を返却
    return {
        // 以前取得した表示行を破棄
        rows: [],
        // 古い次ページトークンを破棄
        nextPageToken: undefined,
        // 追加ページ操作を無効化
        hasNextPage: false,
        // 古い選択状態を破棄
        selectedRowIds: [],
        // エラー種別に対応する見出しを保持
        errorTitle,
        // 利用者向けエラーメッセージを保持
        errorMessage
    };
}

// Salesforceエラーがアクセス権限不足を示すか判定
function isAccessError(error) {
    // fetch形式とApex形式のHTTP状態コードを共通取得
    const status = error?.status ?? error?.body?.statusCode;
    // 認証または権限不足の状態コードを直接判定
    if (status === 401 || status === 403) {
        // 権限確認を促すエラー分類として返却
        return true;
    }

    // 状態コードがないエラーは一般化メッセージ内の標準語句で判定
    return reduceErrors(error, '')
        .toLowerCase()
        .includes('insufficient access');
}
