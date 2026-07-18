import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';
import { createToastMessage, reduceErrors } from 'c/errorUtils';
import {
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
    createSearchFailureState,
    createSearchRequest,
    createSearchSuccessState,
    getCurrentLayout,
    getObjectUiCapability,
    normalizeSortDirection
} from './objectRecordSearchLogic';

// 新しい検索条件に使うページング初期値を共有
const INITIAL_PAGINATION_STATE = createInitialPaginationState();

// 権限に応じた汎用レコード検索と標準レコード操作を管理
export default class ObjectRecordSearch extends LightningElement {
    // 親データボードから検索対象のカタログキーを受け取る
    @api metricKey;

    // 入力中で未確定の検索語を保持
    draftSearchTerm = '';
    // Apex検索へ送る確定済み検索語を保持
    searchTerm = '';
    // datatableへ表示する変換済みレコードを保持
    rows = [];
    // 一括削除対象として選択されたレコードIDを保持
    selectedRowIds = [];
    // Apexが返すオブジェクト、項目、権限設定を保持
    config;
    // 現在表示中のページ番号を保持
    pageNumber = INITIAL_PAGINATION_STATE.pageNumber;
    // Apexが返した現在の取得件数を保持
    pageSize = INITIAL_PAGINATION_STATE.pageSize;
    // 現在ページの検索境界トークンを保持
    currentPageToken = INITIAL_PAGINATION_STATE.currentPageToken;
    // 次ページの検索境界トークンを保持
    nextPageToken = INITIAL_PAGINATION_STATE.nextPageToken;
    // 前ページへ戻るための使用済みトークン履歴を保持
    pageTokenHistory = INITIAL_PAGINATION_STATE.pageTokenHistory;
    // datatableで選択中の列キーを保持
    sortedBy = DEFAULT_SORTED_BY;
    // Apex検索へ送るソート方向を保持
    sortedDirection = DEFAULT_SORT_DIRECTION;
    // 次ページを取得できる状態を保持
    hasNextPage = INITIAL_PAGINATION_STATE.hasNextPage;
    // 検索失敗時のエラー見出しを保持
    errorTitle;
    // 検索失敗時の利用者向けメッセージを保持
    errorMessage;
    // 一括削除中の操作抑止状態を保持
    isDeleting = false;
    // レコードフォーム保存中の操作抑止状態を保持
    isSaving = false;
    // 編集フォームで開くレコードIDを保持
    formRecordId;
    // 作成、編集、アップロード画面の表示状態を保持
    showRecordForm = false;
    // refreshApexへ渡す検索wireレスポンスを保持
    wiredSearchResult;
    // フォーム項目権限に使うgetObjectInfo応答を保持
    objectInfoResult;
    // フォーム構築に使うページレイアウト応答を保持
    formLayoutResult;

    // 検索条件、ソート、ページ境界に応じてApex検索を実行
    @wire(searchRecords, {
        request: '$searchRequest'
    })
    wiredRecords(result) {
        // 手動再読み込みに使えるwireレスポンスを保存
        this.wiredSearchResult = result;
        // 成功データとエラーを排他的に参照
        const { data, error } = result;

        // 取得成功時は設定、行、ページング状態をまとめて更新
        if (data) {
            // 検索応答からLogicが生成した画面状態をまとめて反映
            Object.assign(
                this,
                createSearchSuccessState(data, this.pageSize)
            );
        // 取得失敗時は古い一覧を残さずエラー状態へ移行
        } else if (error) {
            // 検索エラーからLogicが生成した画面状態をまとめて反映
            Object.assign(this, createSearchFailureState(error));
        }
    }

    // 対象オブジェクトの項目属性と既定レコードタイプを取得
    @wire(getObjectInfo, { objectApiName: '$layoutObjectApiName' })
    wiredObjectInfo(result) {
        // フォーム構築と権限判定に応答全体を保存
        this.objectInfoResult = result;
    }

    // 作成または編集モードのFullページレイアウトを取得
    @wire(getLayout, {
        objectApiName: '$layoutObjectApiName',
        layoutType: 'Full',
        mode: '$layoutMode',
        recordTypeId: '$defaultRecordTypeId'
    })
    wiredFormLayout(result) {
        // フォームセクション構築に応答全体を保存
        this.formLayoutResult = result;
    }

    // 検索対象オブジェクトを含む画面タイトルを返却
    get title() {
        // 設定取得前は汎用タイトルへフォールバック
        return this.config?.objectLabel
            ? `${this.config.objectLabel} 一覧`
            : 'レコード一覧';
    }

    // reactive wireへ渡す現在の検索要求を生成
    get searchRequest() {
        // 現在の画面状態からApex検索要求をLogicで生成
        return createSearchRequest({
            // 許可リスト解決に使うカタログキーを渡す
            metricKey: this.metricKey,
            // 確定済み検索語を渡す
            searchTerm: this.searchTerm,
            // 現在ページのカーソル境界を渡す
            currentPageToken: this.currentPageToken,
            // 現在選択中のdatatable列キーを渡す
            sortedBy: this.sortedBy,
            // Apexへ送るソート方向を渡す
            sortedDirection: this.sortedDirection,
            // 画面上の現在ページ番号を渡す
            pageNumber: this.pageNumber,
            // Name相当項目を含む検索設定を渡す
            config: this.config
        });
    }

    // Name相当項目を含む検索入力ラベルを返却
    get searchLabel() {
        // Salesforce項目ラベル未取得時はNameを使用
        const nameFieldLabel = this.config?.nameFieldLabel ?? 'Name';
        // 入力目的が分かる日本語ラベルへ整形
        return `${nameFieldLabel} を検索`;
    }

    // 検索設定と編集権限からdatatable列を生成
    get columns() {
        // 表示列の構築を副作用のないヘルパーへ委譲
        return createColumns({
            // Name相当項目の見出しを設定
            nameFieldLabel: this.config?.nameFieldLabel ?? 'Name',
            // 参照可能な追加表示項目だけを設定
            displayFields: this.config?.displayFields,
            // 編集不可時は行アクションを除外
            editDisabled: this.editDisabled
        });
    }

    // 1件以上の検索結果を表示できるか判定
    get hasRows() {
        // 表示行数をテンプレート用真偽値へ変換
        return this.rows.length > 0;
    }

    // 現在ページを支援技術向けラベルへ整形
    get pageLabel() {
        // 画面上のページ番号を明示
        return `現在のページ: ${this.pageNumber}`;
    }

    // 前ページ操作を無効化する状態を判定
    get previousDisabled() {
        // 処理中または1ページ目では前へ戻れない
        return this.isBusy || this.pageNumber <= 1;
    }

    // 次ページ操作を無効化する状態を判定
    get nextDisabled() {
        // 処理中または次ページなしでは先へ進めない
        return this.isBusy || !this.hasNextPage;
    }

    // 一括削除対象の選択件数を返却
    get selectedCount() {
        // 選択済みレコードIDの要素数を使用
        return this.selectedRowIds.length;
    }

    // 初期取得、削除、保存をまとめた操作中状態を返却
    get isBusy() {
        // いずれかの非同期処理中は重複操作を抑止
        return this.isLoading || this.isDeleting || this.isSaving;
    }

    // 検索wireの初回レスポンス待ち状態を判定
    get isLoading() {
        // データ、エラー、明示エラーのいずれもない間だけ読込中とする
        return (
            !this.errorMessage &&
            !this.wiredSearchResult?.data &&
            !this.wiredSearchResult?.error
        );
    }

    // 一括削除操作を無効化する状態を判定
    get deleteDisabled() {
        // 処理中、権限なし、未選択のいずれかで無効化
        return (
            this.isBusy || !this.config?.deletable || this.selectedCount === 0
        );
    }

    // 新規作成またはアップロード操作の無効状態を判定
    get createDisabled() {
        // ファイルはレイアウトではなく処理中状態だけで判定
        if (this.isFileUploadObject) {
            // アップロード画面の操作中状態をそのまま返却
            return this.isBusy;
        }

        // 標準フォームは対応状況、レイアウト、権限、項目を確認
        return (
            this.isBusy ||
            !this.isRecordFormObject ||
            this.isFormLayoutLoading ||
            !this.config?.createable ||
            this.formFields.length === 0
        );
    }

    // 行編集操作を無効化する状態を判定
    get editDisabled() {
        // 対応状況、レイアウト、権限、項目の不足時に無効化
        return (
            this.isBusy ||
            !this.isRecordFormObject ||
            this.isFormLayoutLoading ||
            !this.config?.updateable ||
            this.formFields.length === 0
        );
    }

    // 対象オブジェクト固有のフォーム操作方式を取得
    get objectUiCapability() {
        // API名に対応する定義または既定値を返却
        return getObjectUiCapability(this.config?.objectApiName);
    }

    // 対象がファイルアップロード方式か判定
    get isFileUploadObject() {
        // オブジェクト固有の画面モードを比較
        return this.objectUiCapability.formMode === FORM_MODE_FILE_UPLOAD;
    }

    // 対象が標準レコードフォーム方式か判定
    get isRecordFormObject() {
        // API名取得済みかつレコードフォーム対応の場合だけ有効化
        return (
            Boolean(this.config?.objectApiName) &&
            this.objectUiCapability.formMode === FORM_MODE_RECORD
        );
    }

    // 現在ファイルアップロード画面を表示するか判定
    get isFileUploadForm() {
        // フォーム表示中かつ対象モードがファイルの場合だけ表示
        return this.showRecordForm && this.isFileUploadObject;
    }

    // 現在標準レコードフォームを表示するか判定
    get showLightningRecordForm() {
        // フォーム表示中かつ対象モードがレコードの場合だけ表示
        return this.showRecordForm && this.isRecordFormObject;
    }

    // UI APIへ渡すフォーム対象オブジェクトAPI名を返却
    get layoutObjectApiName() {
        // 標準フォーム非対応オブジェクトではwireを無効化
        return this.isRecordFormObject ? this.config.objectApiName : undefined;
    }

    // レコードIDの有無からレイアウト取得モードを返却
    get layoutMode() {
        // 編集対象がある場合はEdit、それ以外はCreateを使用
        return this.formRecordId ? 'Edit' : 'Create';
    }

    // 対象オブジェクトの既定レコードタイプIDを返却
    get defaultRecordTypeId() {
        // getObjectInfo取得前または失敗時はundefinedを返却
        return this.objectInfoResult?.data?.defaultRecordTypeId;
    }

    // 標準フォーム用ページレイアウトの取得中状態を判定
    get isFormLayoutLoading() {
        // 対応オブジェクトでデータとエラーの両方がない間だけ有効化
        return (
            this.isRecordFormObject &&
            !this.formLayoutResult?.data &&
            !this.formLayoutResult?.error
        );
    }

    // オブジェクト固有の新規操作ボタンラベルを返却
    get newButtonLabel() {
        // 画面モード定義のラベルをそのまま使用
        return this.objectUiCapability.newButtonLabel;
    }

    // オブジェクト固有のフォーム対応メッセージを返却
    get formCapabilityMessage() {
        // 検索設定取得前は案内を表示しない
        return this.config?.objectApiName
            ? this.objectUiCapability.message
            : undefined;
    }

    // 権限またはフォーム対応に関する案内があるか判定
    get hasAccessMessages() {
        // 生成済み案内の要素数を真偽値へ変換
        return this.accessMessages.length > 0;
    }

    // 現在の権限とフォーム状態から利用者向け案内を生成
    get accessMessages() {
        // 表示条件と文言生成を状態ヘルパーへ委譲
        return createAccessMessages({
            // Apexが返した権限設定を渡す
            config: this.config,
            // オブジェクト固有の操作方式案内を渡す
            formCapabilityMessage: this.formCapabilityMessage,
            // ファイルアップロード方式かどうかを渡す
            isFileUploadObject: this.isFileUploadObject,
            // 標準レコードフォーム方式かどうかを渡す
            isRecordFormObject: this.isRecordFormObject,
            // 入力可能項目不足の表示条件を渡す
            shouldShowFormFieldMessage: this.shouldShowFormFieldMessage,
            // ページレイアウト取得失敗を真偽値へ変換して渡す
            hasFormLayoutError: Boolean(this.formLayoutResult?.error)
        });
    }

    // 作成と編集権限はあるが表示項目がない状態を判定
    get shouldShowFormFieldMessage() {
        // レイアウト取得完了後の標準フォームだけを対象に判定
        return (
            this.isRecordFormObject &&
            !this.isFormLayoutLoading &&
            this.config?.createable &&
            this.config?.updateable &&
            this.formFields.length === 0
        );
    }

    // 全フォームセクションの項目を1つの配列へ平坦化
    get formFields() {
        // ボタン無効化とバリデーション対象判定に使用
        return this.formSections.flatMap((section) => section.fields);
    }

    // ページレイアウトまたは代替定義からフォームセクションを生成
    get formSections() {
        // 標準フォーム非対応オブジェクトでは項目を返さない
        if (!this.isRecordFormObject) {
            // フォームなしの状態を空配列で返却
            return [];
        }

        // ページレイアウトから利用可能な標準項目を抽出
        const layoutSections = this.layoutFormSections;
        // 1項目以上ある場合はオブジェクト別必須項目を補完
        if (layoutSections.length > 0) {
            // 呼び出し元を変更せず補完済みセクションを生成
            return applyFormFieldOverrides({
                // レイアウト由来セクションを基礎に使用
                sections: layoutSections,
                // 対象オブジェクトの補完定義を解決
                objectApiName: this.config?.objectApiName,
                // 項目の作成更新権限を再確認
                fieldInfoByApiName: this.objectInfoResult?.data?.fields,
                // 作成または編集モードを判定
                formRecordId: this.formRecordId
            });
        }

        // レイアウト取得失敗時は許可済み標準項目へフォールバック
        if (this.formLayoutResult?.error) {
            // オブジェクト別の代替フォームセクションを返却
            return this.fallbackFormSections;
        }

        // 取得中または利用可能項目なしの場合は空配列を返却
        return [];
    }

    // 現在レイアウトをテンプレート用フォームセクションへ変換
    get layoutFormSections() {
        // 変換と重複排除をフォームヘルパーへ委譲
        return createLayoutFormSections({
            // 現在の対象オブジェクトとモードに対応するレイアウトを渡す
            layout: this.currentLayout,
            // 項目属性と権限情報を渡す
            fieldInfoByApiName: this.objectInfoResult?.data?.fields,
            // 作成または編集モードを判定するレコードIDを渡す
            formRecordId: this.formRecordId
        });
    }

    // UI API応答から現在モードのFullレイアウトを取得
    get currentLayout() {
        // 応答構造の差異吸収をフォームヘルパーへ委譲
        return getCurrentLayout({
            // getLayoutの成功データを渡す
            formLayoutData: this.formLayoutResult?.data,
            // 対象オブジェクトAPI名を指定
            objectApiName: this.config.objectApiName,
            // CreateまたはEditモードを指定
            layoutMode: this.layoutMode
        });
    }

    // レイアウト取得失敗時の最小フォームセクションを生成
    get fallbackFormSections() {
        // オブジェクト別定義またはName相当項目から構築
        return createFallbackFormSections({
            // オブジェクト別補完定義の解決に使用
            objectApiName: this.config?.objectApiName,
            // 個別定義がない場合の最小項目に使用
            nameFieldApiName: this.config?.nameFieldApiName
        });
    }

    // 現在の画面モードに対応するフォームタイトルを返却
    get formTitle() {
        // 設定取得前は汎用レコードラベルへフォールバック
        const objectLabel = this.config?.objectLabel ?? 'レコード';
        // ファイルは作成ではなくアップロードとして案内
        if (this.isFileUploadObject) {
            // ファイル専用の操作タイトルを返却
            return 'ファイルをアップロード';
        }

        // レコードIDの有無で編集と作成を切り替え
        return this.formRecordId
            ? `${objectLabel}を編集`
            : `${objectLabel}を作成`;
    }

    // 検索条件の有無に応じた空状態メッセージを返却
    get emptyMessage() {
        // 検索実行後は条件不一致であることを明示
        if (this.searchTerm) {
            // 検索条件に一致しない空状態文言を返却
            return '検索条件に一致するレコードが見つかりません。';
        }
        // 条件なしの場合は対象レコードがないことを案内
        return 'レコードが見つかりません。';
    }

    // 親データボードへ戻る操作を通知
    handleBack() {
        // 親コンポーネントへ画面切り替えイベントを送信
        this.dispatchEvent(new CustomEvent('back'));
    }

    // 利用者操作で現在の検索結果を再取得
    async handleRefresh() {
        // wire初期化前の再読み込み要求は処理しない
        if (!this.wiredSearchResult) {
            // 現在表示を維持して再読み込みを終了
            return;
        }

        // 現在の検索条件を維持してApexを再実行
        await refreshApex(this.wiredSearchResult);
    }

    // 検索入力値を未確定状態として保持
    handleSearchInput(event) {
        // 入力のたびにApexを呼ばずローカル状態だけを更新
        this.draftSearchTerm = event.target.value;
    }

    // 検索入力上のEnterキーを検索実行へ変換
    handleSearchKeyUp(event) {
        // Enter以外のキー操作では検索を開始しない
        if (event.key === 'Enter') {
            // 検索ボタンと同じ確定処理を呼び出す
            this.handleSearch();
        }
    }

    // 入力中の検索語を確定して1ページ目から検索
    handleSearch() {
        // 前後の空白を除いた値だけをApex検索へ反映
        this.searchTerm = this.draftSearchTerm.trim();
        // 新しい検索条件ではカーソル履歴を初期化
        this.resetPagination();
    }

    // トークン履歴を使って1つ前のページへ戻る
    handlePreviousPage() {
        // 処理中または1ページ目では状態を変更しない
        if (this.previousDisabled) {
            // 現在ページを維持して操作を終了
            return;
        }

        // 現在状態から前ページの検索境界を生成して反映
        this.applyPaginationState(
            createPreviousPageState({
                // 現在ページ番号から1つ戻す基準を渡す
                pageNumber: this.pageNumber,
                // 前ページ境界を解決する履歴を渡す
                pageTokenHistory: this.pageTokenHistory
            })
        );
    }

    // Apex応答の次ページトークンを使って先へ進む
    handleNextPage() {
        // 処理中または次ページなしでは状態を変更しない
        if (this.nextDisabled) {
            // 現在ページを維持して操作を終了
            return;
        }

        // 現在状態から次ページの検索境界を生成して反映
        this.applyPaginationState(
            createNextPageState({
                // 現在ページ番号から1つ進める基準を渡す
                pageNumber: this.pageNumber,
                // 現在境界を履歴へ追加するため既存履歴を渡す
                pageTokenHistory: this.pageTokenHistory,
                // Apex応答の次ページ境界を渡す
                nextPageToken: this.nextPageToken
            })
        );
    }

    // datatableのソート変更をApex検索条件へ反映
    handleSort(event) {
        // 選択列とソート方向をイベントから取得
        const { fieldName, sortDirection } = event.detail;
        // datatableへ返す現在列キーを保存
        this.sortedBy = fieldName;
        // Apex許可値へ正規化した方向を保存
        this.sortedDirection = normalizeSortDirection(sortDirection);
        // 新しいソート条件ではカーソル履歴を初期化
        this.resetPagination();
    }

    // datatableの現在選択行を一括削除対象へ反映
    handleRowSelection(event) {
        // Wrapper行からレコードIDだけを抽出して保持
        this.selectedRowIds = event.detail.selectedRows.map((row) => row.id);
    }

    // datatableの行アクションから編集フォームを開く
    handleRowAction(event) {
        // 編集以外の操作または編集不可状態では処理しない
        if (event.detail.action.name !== 'edit' || this.editDisabled) {
            // 現在一覧を維持して行操作を終了
            return;
        }

        // 選択行のIDを編集対象として共通フォーム表示処理へ渡す
        this.openRecordForm(event.detail.row.id);
    }

    // 新規作成またはファイルアップロード画面を開く
    handleNewRecord() {
        // 作成不可または処理中の場合は画面を切り替えない
        if (this.createDisabled) {
            // 現在一覧を維持して新規操作を終了
            return;
        }

        // レコードIDなしで共通フォーム表示処理を呼び出す
        this.openRecordForm();
    }

    // レコードフォームを閉じて一覧表示へ戻る
    handleCloseRecordForm() {
        // 作成、編集、アップロード画面を非表示にする
        this.showRecordForm = false;
        // 以前の編集対象レコードIDを破棄
        this.formRecordId = undefined;
        // エラーやキャンセル時も保存中状態を解除
        this.isSaving = false;
    }

    // 標準レコードフォーム送信前に全入力項目を検証
    handleRecordFormSubmit(event) {
        // 各lightning-input-fieldのエラー表示と判定をまとめて実行
        const isValid = [
            ...this.template.querySelectorAll('lightning-input-field')
        ].reduce((valid, field) => field.reportValidity() && valid, true);
        // 1項目でも不正な場合はSalesforceへの送信を中止
        if (!isValid) {
            // lightning-record-edit-formの既定送信を抑止
            event.preventDefault();
            // 保存中状態へ移行せず送信処理を終了
            return;
        }

        // 保存完了イベントまで重複操作を抑止
        this.isSaving = true;
    }

    // 標準レコードフォーム保存成功後に一覧と親件数を更新
    async handleRecordFormSuccess() {
        // 編集対象の有無に応じてトースト見出しを切り替え
        const toastTitle = this.formRecordId ? '更新しました' : '作成しました';
        // 利用者へ保存成功を通知
        this.showToast(
            toastTitle,
            `${this.config.objectLabel}を保存しました。`,
            'success'
        );
        // 一覧へ戻りフォーム状態を初期化
        this.handleCloseRecordForm();
        // 検索結果を再取得して親データボードへ変更を通知
        await this.refreshRecordsAndNotifyChange();
    }

    // ファイルアップロード完了後に一覧と親件数を更新
    async handleUploadFinished(event) {
        // UI APIイベントから登録されたファイル件数を取得
        const uploadedCount = event.detail?.files?.length ?? 0;
        // 利用者へアップロード成功件数を通知
        this.showToast(
            'アップロードしました',
            `${uploadedCount} 件のファイルを登録しました。`,
            'success'
        );
        // 一覧へ戻りアップロード画面状態を初期化
        this.handleCloseRecordForm();
        // 検索結果を再取得して親データボードへ変更を通知
        await this.refreshRecordsAndNotifyChange();
    }

    // 標準レコードフォーム保存失敗をトーストへ表示
    handleRecordFormError(event) {
        // 再試行できるよう保存中状態を解除
        this.isSaving = false;
        // Salesforceメッセージを優先し、ない場合は一般文言を使用
        const message =
            event.detail?.message ??
            `${this.config.objectLabel}を保存できませんでした。`;
        // 利用者へ保存失敗内容を通知
        this.showToast('保存に失敗しました', message, 'error');
    }

    // 選択されたレコードをUSER_MODE Apexで一括削除
    async handleDeleteSelected() {
        // 権限なし、未選択、処理中の場合は削除を開始しない
        if (this.deleteDisabled) {
            // 現在一覧を維持して削除操作を終了
            return;
        }

        // 削除完了まで重複操作を抑止
        this.isDeleting = true;
        // Apex削除、結果通知、一覧更新を1つの処理単位で実行
        try {
            // カタログキーと選択IDをApex削除処理へ渡す
            const result = await deleteRecords({
                // 許可された対象オブジェクトを解決するキーを指定
                metricKey: this.metricKey,
                // 現在選択中のレコードID一覧を指定
                recordIds: this.selectedRowIds
            });
            // 成功件数と要求件数を利用者へ通知
            this.showToast(
                '削除しました',
                `${result.deletedCount} / ${result.requestedCount} 件を削除しました。`,
                'success'
            );
            // 部分失敗がある場合は成功通知に続けて警告
            if (result.errors?.length) {
                // 行単位エラーを改行区切りのトーストへ変換
                this.showToast(
                    '一部削除できませんでした',
                    createToastMessage(
                        result.errors,
                        '一部のレコードを削除できませんでした。'
                    ),
                    'warning'
                );
            }
            // 削除後の一覧を再取得して親件数を更新
            await this.refreshRecordsAndNotifyChange();
        // Apex削除失敗時は一覧をエラー状態へ移行
        } catch (error) {
            // 削除処理全体の失敗を画面上のエラーへ反映
            this.errorMessage = reduceErrors(
                error,
                'レコード一覧を読み込めませんでした。'
            );
            // 同じ利用者向け文言をトーストでも通知
            this.showToast('削除に失敗しました', this.errorMessage, 'error');
        // 成否にかかわらず削除操作の抑止を解除
        } finally {
            // 成否にかかわらず削除中状態を解除
            this.isDeleting = false;
        }
    }

    // レコード変更後に検索結果を更新して親へ通知
    async refreshRecordsAndNotifyChange() {
        // 現在の検索条件を維持してApexを再実行
        await refreshApex(this.wiredSearchResult);
        // 親データボードへ件数再取得を要求
        this.dispatchEvent(new CustomEvent('recordschanged'));
    }

    // Lightning標準トーストを共通形式で表示
    showToast(title, message, variant) {
        // 呼び出し元の内容をShowToastEventへ変換して送信
        this.dispatchEvent(
            new ShowToastEvent({
                // トースト見出しを設定
                title,
                // 利用者向け本文を設定
                message,
                // success、warning、errorの表示種別を設定
                variant
            })
        );
    }

    // 新しい検索条件に合わせてページング状態を初期化
    resetPagination() {
        // 副作用のない初期状態生成結果を現在コンポーネントへ反映
        this.applyPaginationState(createInitialPaginationState());
    }

    // ページングヘルパーの部分状態を現在コンポーネントへ反映
    applyPaginationState(paginationState) {
        // 応答や画面遷移で変更する項目だけをまとめて更新
        Object.assign(this, paginationState);
    }

    // 作成または編集対象を設定してレコードフォームを表示
    openRecordForm(recordId) {
        // レコードIDがある場合は編集、ない場合は新規作成として保持
        this.formRecordId = recordId;
        // 対象オブジェクトに対応するフォーム画面へ切り替え
        this.showRecordForm = true;
    }
}
