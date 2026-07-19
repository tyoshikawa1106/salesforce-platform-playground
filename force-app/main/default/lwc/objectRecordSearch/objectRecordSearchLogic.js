import { reduceErrors } from 'c/errorUtils';
import {
    createColumns,
    createDisplayRow,
    getSortFieldApiName
} from './objectRecordSearchDisplay';
import {
    FORM_MODE_FILE_UPLOAD,
    FORM_MODE_RECORD,
    applyFormFieldOverrides,
    createFallbackFormSections,
    createLayoutFormSections,
    getCurrentLayout,
    getObjectUiCapability
} from './objectRecordSearchForm';
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

// コンポーネント生成時に使う検索画面の初期状態を生成
export function createInitialSearchState() {
    // ソート条件とページング条件を同じ初期状態へまとめる
    return {
        // Name相当列を初期ソート対象に設定
        sortedBy: DEFAULT_SORTED_BY,
        // 初期ソート方向を昇順に設定
        sortedDirection: DEFAULT_SORT_DIRECTION,
        // 1ページ目のページング状態を展開
        ...createInitialPaginationState()
    };
}

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

// 検索設定と編集可否から画面用のテーブル列を生成
export function createTableColumns({ config, editDisabled }) {
    // Displayへ画面設定を展開して完成済み列を取得
    return createColumns({
        // Name相当項目の見出しを設定
        nameFieldLabel: config?.nameFieldLabel ?? 'Name',
        // 参照可能な追加表示項目だけを設定
        displayFields: config?.displayFields,
        // 編集不可時は行アクションを除外
        editDisabled
    });
}

// 入力中の検索語を確定して1ページ目の検索状態を生成
export function createSearchCriteriaState(draftSearchTerm = '') {
    // 確定済み検索語と初期ページング状態をまとめて返却
    return {
        // 前後の空白を除いた値だけを検索条件へ使用
        searchTerm: draftSearchTerm.trim(),
        // 新しい検索条件ではカーソル履歴を初期化
        ...createInitialPaginationState()
    };
}

// 現在状態から1つ前のページを検索する状態を生成
export function createPreviousSearchState({ pageNumber, pageTokenHistory }) {
    // Stateへ現在ページ情報を渡して前ページ境界を解決
    return createPreviousPageState({ pageNumber, pageTokenHistory });
}

// Apex応答の次ページトークンを使う検索状態を生成
export function createNextSearchState({
    pageNumber,
    pageTokenHistory,
    nextPageToken
}) {
    // Stateへ現在ページ情報を渡して次ページ境界を解決
    return createNextPageState({
        // 現在ページ番号を渡す
        pageNumber,
        // 使用済みページトークン履歴を渡す
        pageTokenHistory,
        // Apex応答の次ページトークンを渡す
        nextPageToken
    });
}

// datatable操作から新しいソート検索状態を生成
export function createSortSearchState({ fieldName, sortDirection }) {
    // ソート条件と初期ページング状態をまとめて返却
    return {
        // datatableへ返す現在列キーを保持
        sortedBy: fieldName,
        // datatableの方向をApex許可値へ正規化
        sortedDirection: normalizeSortDirection(sortDirection),
        // 新しいソート条件ではカーソル履歴を初期化
        ...createInitialPaginationState()
    };
}

// 検索設定と編集対象からUI API wireへ渡す軽量状態を生成
export function createFormWireState({
    config,
    objectInfoResult,
    formRecordId
}) {
    // 対象オブジェクト固有のフォーム操作方式を取得
    const objectUiCapability = getObjectUiCapability(config?.objectApiName);
    // 対象がファイルアップロード方式か判定
    const isFileUploadObject =
        objectUiCapability.formMode === FORM_MODE_FILE_UPLOAD;
    // API名取得済みかつレコードフォーム対応の場合だけ有効化
    const isRecordFormObject = Boolean(config?.objectApiName) &&
        objectUiCapability.formMode === FORM_MODE_RECORD;
    // レコードIDの有無でレイアウト取得モードを決定
    const layoutMode = formRecordId ? 'Edit' : 'Create';
    // 標準フォーム非対応オブジェクトではlayout wireを無効化
    const layoutObjectApiName = isRecordFormObject
        ? config.objectApiName
        : undefined;
    // getObjectInfo取得前または失敗時はレコードタイプを指定しない
    const defaultRecordTypeId =
        objectInfoResult?.data?.defaultRecordTypeId;

    // UI API wireの再実行条件だけを含む状態を返却
    return {
        // 対象がファイルアップロード方式か保持
        isFileUploadObject,
        // 対象が標準レコードフォーム方式か保持
        isRecordFormObject,
        // UI APIのlayout wireへ渡すオブジェクトAPI名を保持
        layoutObjectApiName,
        // UI APIのlayout wireへ渡すモードを保持
        layoutMode,
        // UI APIのlayout wireへ渡すレコードタイプIDを保持
        defaultRecordTypeId,
        // オブジェクト固有のフォーム操作方式を保持
        objectUiCapability
    };
}

// UI API応答から再利用可能なフォーム表示状態を生成
export function createFormViewState({
    config,
    objectInfoResult,
    formLayoutResult,
    formRecordId,
    formWireState
}) {
    // wire用の軽量状態からフォーム方式とレイアウト条件を取得
    const {
        isFileUploadObject,
        isRecordFormObject,
        layoutMode,
        objectUiCapability
    } = formWireState;
    // 対応オブジェクトでデータとエラーがない間だけ取得中とする
    const isFormLayoutLoading = Boolean(
        isRecordFormObject &&
            !formLayoutResult?.data &&
            !formLayoutResult?.error
    );
    // レイアウトまたは代替定義からフォームセクションを生成
    const formSections = createFormSections({
        // Apexが返した対象オブジェクト設定を渡す
        config,
        // 項目属性と権限情報を含む応答を渡す
        objectInfoResult,
        // Fullページレイアウト応答を渡す
        formLayoutResult,
        // 作成または編集モードを判定するIDを渡す
        formRecordId,
        // 標準フォーム対応状況を渡す
        isRecordFormObject,
        // CreateまたはEditの現在モードを渡す
        layoutMode
    });
    // ボタン制御と案内判定に使う全項目を平坦化
    const formFields = formSections.flatMap((section) => section.fields);
    // 作成と編集権限はあるが表示項目がない状態を判定
    const shouldShowFormFieldMessage = Boolean(
        isRecordFormObject &&
            !isFormLayoutLoading &&
            config?.createable &&
            config?.updateable &&
            formFields.length === 0
    );
    // 検索設定取得後だけオブジェクト固有の案内を使用
    const formCapabilityMessage = config?.objectApiName
        ? objectUiCapability.message
        : undefined;
    // 権限とフォーム対応状況から利用者向け案内を生成
    const accessMessages = createAccessMessages({
        // Apexが返した権限設定を渡す
        config,
        // オブジェクト固有の操作方式案内を渡す
        formCapabilityMessage,
        // ファイルアップロード方式かどうかを渡す
        isFileUploadObject,
        // 標準レコードフォーム方式かどうかを渡す
        isRecordFormObject,
        // 入力可能項目不足の表示条件を渡す
        shouldShowFormFieldMessage,
        // ページレイアウト取得失敗を真偽値へ変換して渡す
        hasFormLayoutError: Boolean(formLayoutResult?.error)
    });
    // 設定取得前は汎用レコードラベルへフォールバック
    const objectLabel = config?.objectLabel ?? 'レコード';
    // ファイルと標準レコードで操作目的に対応するタイトルを生成
    const formTitle = isFileUploadObject
        ? 'ファイルをアップロード'
        : formRecordId
          ? `${objectLabel}を編集`
          : `${objectLabel}を作成`;

    // テンプレートと操作可否が再利用するフォーム表示状態を返却
    return {
        // 処理中状態を除く新規作成不可条件を保持
        createUnavailable: isFileUploadObject
            ? false
            : Boolean(
                  !isRecordFormObject ||
                      isFormLayoutLoading ||
                      !config?.createable ||
                      formFields.length === 0
              ),
        // 処理中状態を除く行編集不可条件を保持
        editUnavailable: Boolean(
            !isRecordFormObject ||
                isFormLayoutLoading ||
                !config?.updateable ||
                formFields.length === 0
        ),
        // ファイルアップロード方式か保持
        isFileUploadObject,
        // 標準レコードフォーム方式か保持
        isRecordFormObject,
        // フォームレイアウトの取得中状態を保持
        isFormLayoutLoading,
        // オブジェクト固有の新規操作ボタンラベルを保持
        newButtonLabel: objectUiCapability.newButtonLabel,
        // 権限または対応状況の案内一覧を保持
        accessMessages,
        // 案内を1件以上表示できるか保持
        hasAccessMessages: accessMessages.length > 0,
        // レイアウト順のフォームセクションを保持
        formSections,
        // 作成、編集、アップロードに対応するタイトルを保持
        formTitle
    };
}

// UI API応答からフォームセクションを画面単位で生成
function createFormSections({
    config,
    objectInfoResult,
    formLayoutResult,
    formRecordId,
    isRecordFormObject,
    layoutMode
}) {
    // 標準フォーム非対応オブジェクトでは項目を返さない
    if (!isRecordFormObject) {
        // フォームなしの状態を空配列で返却
        return [];
    }

    // UI API応答から現在モードのFullレイアウトを取得
    const currentLayout = getCurrentLayout({
        // getLayoutの成功データを渡す
        formLayoutData: formLayoutResult?.data,
        // 対象オブジェクトAPI名を指定
        objectApiName: config.objectApiName,
        // CreateまたはEditモードを指定
        layoutMode
    });
    // 現在レイアウトをテンプレート用フォームセクションへ変換
    const layoutSections = createLayoutFormSections({
        // 現在の対象オブジェクトとモードに対応するレイアウトを渡す
        layout: currentLayout,
        // 項目属性と権限情報を渡す
        fieldInfoByApiName: objectInfoResult?.data?.fields,
        // 作成または編集モードを判定するレコードIDを渡す
        formRecordId
    });
    // 1項目以上ある場合はオブジェクト別必須項目を補完
    if (layoutSections.length > 0) {
        // 呼び出し元を変更せず補完済みセクションを生成
        return applyFormFieldOverrides({
            // レイアウト由来セクションを基礎に使用
            sections: layoutSections,
            // 対象オブジェクトの補完定義を解決
            objectApiName: config.objectApiName,
            // 項目の作成更新権限を再確認
            fieldInfoByApiName: objectInfoResult?.data?.fields,
            // 作成または編集モードを判定
            formRecordId
        });
    }

    // レイアウト取得失敗時は許可済み標準項目へフォールバック
    if (formLayoutResult?.error) {
        // オブジェクト別定義またはName相当項目から構築
        return createFallbackFormSections({
            // オブジェクト別補完定義の解決に使用
            objectApiName: config.objectApiName,
            // 個別定義がない場合の最小項目に使用
            nameFieldApiName: config.nameFieldApiName
        });
    }

    // 取得中または利用可能項目なしの場合は空配列を返却
    return [];
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
