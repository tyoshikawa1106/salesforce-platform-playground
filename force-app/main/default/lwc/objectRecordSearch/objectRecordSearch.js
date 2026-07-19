import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';
import { createToastMessage, reduceErrors } from 'c/errorUtils';
import {
    createFormViewState,
    createFormWireState,
    createInitialSearchState,
    createNextSearchState,
    createPreviousSearchState,
    createSearchCriteriaState,
    createSearchFailureState,
    createSearchRequest,
    createSearchSuccessState,
    createSortSearchState,
    createTableColumns
} from './objectRecordSearchLogic';

// コンポーネント生成時に使う検索画面の初期値を共有
const INITIAL_SEARCH_STATE = createInitialSearchState();

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
    pageNumber = INITIAL_SEARCH_STATE.pageNumber;
    // Apexが返した現在の取得件数を保持
    pageSize = INITIAL_SEARCH_STATE.pageSize;
    // 現在ページの検索境界トークンを保持
    currentPageToken = INITIAL_SEARCH_STATE.currentPageToken;
    // 次ページの検索境界トークンを保持
    nextPageToken = INITIAL_SEARCH_STATE.nextPageToken;
    // 前ページへ戻るための使用済みトークン履歴を保持
    pageTokenHistory = INITIAL_SEARCH_STATE.pageTokenHistory;
    // datatableで選択中の列キーを保持
    sortedBy = INITIAL_SEARCH_STATE.sortedBy;
    // Apex検索へ送るソート方向を保持
    sortedDirection = INITIAL_SEARCH_STATE.sortedDirection;
    // 次ページを取得できる状態を保持
    hasNextPage = INITIAL_SEARCH_STATE.hasNextPage;
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
    // UI API wireへ渡す軽量なフォーム条件を保持
    formWireState = createFormWireState({});
    // UI API応答変更時に生成したフォーム表示状態を保持
    formViewState = createFormViewState({
        formWireState: this.formWireState
    });

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
            // 対象オブジェクト変更をフォーム状態へ反映
            this.updateFormState();
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
        // 既定レコードタイプと項目権限をフォーム状態へ反映
        this.updateFormState();
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
        // 最新ページレイアウトからフォーム表示状態を再生成
        this.updateFormState();
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
        // 検索設定と編集可否から画面用の列をLogicで生成
        return createTableColumns({
            // Apexが返した表示設定を渡す
            config: this.config,
            // 現在のフォーム状態を反映した編集可否を渡す
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
        // 処理中またはフォーム構造上の作成不可状態で無効化
        return this.isBusy || this.formViewState.createUnavailable;
    }

    // 行編集操作を無効化する状態を判定
    get editDisabled() {
        // 処理中またはフォーム構造上の編集不可状態で無効化
        return this.isBusy || this.formViewState.editUnavailable;
    }

    // 現在ファイルアップロード画面を表示するか判定
    get isFileUploadForm() {
        // モーダル表示中かつファイル方式の場合だけ表示
        return this.showRecordForm && this.formViewState.isFileUploadObject;
    }

    // 現在標準レコードフォームを表示するか判定
    get showLightningRecordForm() {
        // モーダル表示中かつ標準レコード方式の場合だけ表示
        return this.showRecordForm && this.formViewState.isRecordFormObject;
    }

    // UI APIへ渡すフォーム対象オブジェクトAPI名を返却
    get layoutObjectApiName() {
        // レイアウト解析を伴わない軽量状態からwire条件を返却
        return this.formWireState.layoutObjectApiName;
    }

    // レコードIDの有無からレイアウト取得モードを返却
    get layoutMode() {
        // レイアウト解析を伴わない軽量状態からwire条件を返却
        return this.formWireState.layoutMode;
    }

    // 対象オブジェクトの既定レコードタイプIDを返却
    get defaultRecordTypeId() {
        // レイアウト解析を伴わない軽量状態からwire条件を返却
        return this.formWireState.defaultRecordTypeId;
    }

    // オブジェクト固有の新規操作ボタンラベルを返却
    get newButtonLabel() {
        // Logicが生成したオブジェクト別の操作ラベルを返却
        return this.formViewState.newButtonLabel;
    }

    // 権限またはフォーム対応に関する案内があるか判定
    get hasAccessMessages() {
        // Logicが生成した案内有無をテンプレートへ返却
        return this.formViewState.hasAccessMessages;
    }

    // 現在の権限とフォーム状態から利用者向け案内を生成
    get accessMessages() {
        // Logicが生成した権限と対応状況の案内一覧を返却
        return this.formViewState.accessMessages;
    }

    // ページレイアウトまたは代替定義からフォームセクションを生成
    get formSections() {
        // LogicがUI API応答から生成したセクションを返却
        return this.formViewState.formSections;
    }

    // 現在の画面モードに対応するフォームタイトルを返却
    get formTitle() {
        // Logicが作成、編集、アップロード別に生成したタイトルを返却
        return this.formViewState.formTitle;
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
        // 検索語確定とページング初期化を1つの画面状態として反映
        Object.assign(
            this,
            createSearchCriteriaState(this.draftSearchTerm)
        );
    }

    // トークン履歴を使って1つ前のページへ戻る
    handlePreviousPage() {
        // 処理中または1ページ目では状態を変更しない
        if (this.previousDisabled) {
            // 現在ページを維持して操作を終了
            return;
        }

        // 現在状態からLogicが生成した前ページ検索状態を反映
        Object.assign(
            this,
            createPreviousSearchState({
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

        // 現在状態からLogicが生成した次ページ検索状態を反映
        Object.assign(
            this,
            createNextSearchState({
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
        // ソート条件とページング初期化を1つの画面状態として反映
        Object.assign(
            this,
            createSortSearchState({ fieldName, sortDirection })
        );
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
        // 作成モードへ戻したwire条件と表示状態を再生成
        this.updateFormState();
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

    // 作成または編集対象を設定してレコードフォームを表示
    openRecordForm(recordId) {
        // レコードIDがある場合は編集、ない場合は新規作成として保持
        this.formRecordId = recordId;
        // 作成または編集モードに対応するフォーム状態を生成
        this.updateFormState();
        // 対象オブジェクトに対応するフォーム画面へ切り替え
        this.showRecordForm = true;
    }

    // フォーム入力元が変わった時だけwire条件と表示状態を再生成
    updateFormState() {
        // レイアウト取得を伴わないwire条件を先に更新
        this.formWireState = createFormWireState({
            // Apexが返した対象オブジェクト設定を渡す
            config: this.config,
            // 既定レコードタイプを含むUI API応答を渡す
            objectInfoResult: this.objectInfoResult,
            // CreateまたはEditを判定するレコードIDを渡す
            formRecordId: this.formRecordId
        });
        // 最新のwire応答から高コストなフォーム構造を1度だけ生成
        this.formViewState = createFormViewState({
            // Apexが返した対象オブジェクト設定を渡す
            config: this.config,
            // 項目属性と権限情報を含むUI API応答を渡す
            objectInfoResult: this.objectInfoResult,
            // 現在モードのページレイアウト応答を渡す
            formLayoutResult: this.formLayoutResult,
            // 作成または編集モードを判定するレコードIDを渡す
            formRecordId: this.formRecordId,
            // 先に生成したフォーム方式とwire条件を渡す
            formWireState: this.formWireState
        });
    }
}
