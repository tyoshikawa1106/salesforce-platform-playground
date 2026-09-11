import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';
import ObjectRecordFormModal from 'c/objectRecordFormModal';
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
    createTableColumns,
    hasFormWireInputChanged
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
    // 現在ページの標準カーソルと取得位置を保持
    currentPagePosition = INITIAL_SEARCH_STATE.currentPagePosition;
    // 次ページの標準カーソルと取得位置を保持
    nextPagePosition = INITIAL_SEARCH_STATE.nextPagePosition;
    // 前ページへ戻るための使用済み取得位置の履歴を保持
    pagePositionHistory = INITIAL_SEARCH_STATE.pagePositionHistory;
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
    // 再取得中の検索・保存・削除操作を抑止
    isRefreshing = false;
    // 検索条件変更後の応答待ちを初回wireとは別に管理
    isSearchPending = false;
    // 編集フォームで開くレコードIDを保持
    formRecordId;
    // 作成、編集、アップロード画面の表示状態を保持
    showRecordForm = false;
    // refreshApexへ渡す検索wireレスポンスを保持
    wiredSearchResult;
    // 再読み込みで新しい結果集合を作るため先頭ページのwireを保持
    firstPageWireResult;
    // 結果が表示上限に達した場合は検索の絞り込みを案内
    isResultLimitReached = false;
    // フォーム項目権限に使うgetObjectInfo応答を保持
    objectInfoResult;
    // 作成用フォームの項目と操作可否を判定する応答を保持
    createLayoutResult;
    // 編集用フォームの項目と操作可否を判定する応答を保持
    editLayoutResult;
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

        // 失敗応答も保持し、再試行で以前の検索条件を更新しない
        if (!this.currentPagePosition && (data || error)) {
            // 現在の先頭ページ要求を再読み込みの対象にする
            this.firstPageWireResult = result;
        }

        // 取得成功時は設定、行、ページング状態をまとめて更新
        if (data) {
            // 取得上限に達した応答を全件表示と区別
            this.isResultLimitReached = Boolean(data.isResultLimitReached);
            // 検索成功応答でページ操作の抑止を解除
            this.isSearchPending = false;
            // 検索応答からLogicが生成した画面状態をまとめて反映
            Object.assign(
                this,
                createSearchSuccessState(data, this.pageSize)
            );
            // 対象オブジェクト変更をフォーム状態へ反映
            this.updateFormState();
        // 取得失敗時は古い一覧を残さずエラー状態へ移行
        } else if (error) {
            // 取得失敗時に前回の上限案内を残さない
            this.isResultLimitReached = false;
            // 検索失敗後も再検索を許可
            this.isSearchPending = false;
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

    // 一覧表示時から作成用のFullページレイアウトを取得
    @wire(getLayout, {
        objectApiName: '$layoutObjectApiName',
        layoutType: 'Full',
        mode: 'Create',
        recordTypeId: '$defaultRecordTypeId'
    })
    wiredCreateLayout(result) {
        // 作成用応答だけを保存して編集用応答と混在させない
        this.createLayoutResult = result;
        // 作成項目と新規ボタンの可否を更新
        this.updateFormState();
    }

    // 作成権限に依存せず編集用のFullページレイアウトを取得
    @wire(getLayout, {
        objectApiName: '$layoutObjectApiName',
        layoutType: 'Full',
        mode: 'Edit',
        recordTypeId: '$defaultRecordTypeId'
    })
    wiredEditLayout(result) {
        // 編集用応答だけを保存して作成用応答と混在させない
        this.editLayoutResult = result;
        // 編集項目と行アクションの可否を更新
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
            currentPagePosition: this.currentPagePosition,
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

    // 初期取得、再取得、削除、保存をまとめた操作中状態を返却
    get isBusy() {
        // いずれかの非同期処理中は重複操作を抑止
        return this.isLoading || this.isDeleting || this.isRefreshing;
    }

    // 初回取得と検索条件変更後の応答待ち状態を判定
    get isLoading() {
        // 明示的な検索待ちと初回wire未取得を読込中とする
        return (
            // 前のwire結果が残っていても新しい検索の完了を待つ
            this.isSearchPending ||
            // 初回wire応答前の取得状態を判定
            (!this.errorMessage &&
                !this.wiredSearchResult?.data &&
                !this.wiredSearchResult?.error)
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
        // wire未取得または別操作中の重複更新を拒否
        if (!this.wiredSearchResult || this.isBusy) {
            // 現在の処理が完了するまで状態を維持
            return;
        }
        // 再取得固有のエラー処理と操作抑止を適用
        await this.refreshRecords();
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
        // 進行中の検索や保存に重なる検索要求を拒否
        if (this.isBusy) {
            // 現在の要求が完了するまで条件を維持
            return;
        }
        // 検索語確定とページング初期化を1つの画面状態として反映
        this.applySearchState(
            createSearchCriteriaState(this.draftSearchTerm)
        );
    }

    // 取得位置の履歴を使って1つ前のページへ戻る
    handlePreviousPage() {
        // 処理中または1ページ目では状態を変更しない
        if (this.previousDisabled) {
            // 現在ページを維持して操作を終了
            return;
        }

        // 現在状態からLogicが生成した前ページ検索状態を反映
        this.applySearchState(
            createPreviousSearchState({
                // 現在ページ番号から1つ戻す基準を渡す
                pageNumber: this.pageNumber,
                // 前ページ境界を解決する履歴を渡す
                pagePositionHistory: this.pagePositionHistory
            })
        );
    }

    // Apex応答の次ページ取得位置を使って先へ進む
    handleNextPage() {
        // 処理中または次ページなしでは状態を変更しない
        if (this.nextDisabled) {
            // 現在ページを維持して操作を終了
            return;
        }

        // 現在状態からLogicが生成した次ページ検索状態を反映
        this.applySearchState(
            createNextSearchState({
                // 現在ページ番号から1つ進める基準を渡す
                pageNumber: this.pageNumber,
                // 現在境界を履歴へ追加するため既存履歴を渡す
                pagePositionHistory: this.pagePositionHistory,
                // Apex応答の次ページ境界を渡す
                nextPagePosition: this.nextPagePosition
            })
        );
    }

    // datatableのソート変更をApex検索条件へ反映
    handleSort(event) {
        // 応答待ちや保存中のソート変更を拒否
        if (this.isBusy) {
            // 現在のソート条件を維持
            return;
        }
        // 選択列とソート方向をイベントから取得
        const { fieldName, sortDirection } = event.detail;
        // ソート条件とページング初期化を1つの画面状態として反映
        this.applySearchState(
            createSortSearchState({ fieldName, sortDirection })
        );
    }

    // 問い合わせ条件が変わる場合だけ応答待ちを開始
    applySearchState(nextState) {
        // wireが再実行されるかを現在の問い合わせ値で判定
        const previousRequest = JSON.stringify(this.searchRequest);
        // 状態を変更する前に次の問い合わせを組み立てる
        const nextRequest = createSearchRequest({
            metricKey: this.metricKey,
            config: this.config,
            searchTerm: this.searchTerm,
            currentPagePosition: this.currentPagePosition,
            sortedBy: this.sortedBy,
            sortedDirection: this.sortedDirection,
            pageNumber: this.pageNumber,
            ...nextState
        });
        // 同じ問い合わせでは取得済みの次ページ情報を保持
        if (previousRequest === JSON.stringify(nextRequest)) {
            return;
        }
        // ページと検索条件を同じ状態遷移で更新
        Object.assign(this, nextState);
        // 変更後の問い合わせへの応答を待つ
        this.isSearchPending = true;
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
            // 1件以上削除できた場合だけ成功件数を利用者へ通知
            if (result.deletedCount > 0) {
                // 成功件数と要求件数を利用者へ通知
                this.showToast(
                    '削除しました',
                    `${result.deletedCount} / ${result.requestedCount} 件を削除しました。`,
                    'success'
                );
            }
            // 削除失敗がある場合は成功件数に応じた見出しで警告
            if (result.errors?.length) {
                // 全件失敗を部分失敗と誤認させない警告見出しを選択
                const warningTitle =
                    result.deletedCount > 0
                        ? '一部削除できませんでした'
                        : '削除できませんでした';
                // 行単位エラーを改行区切りのトーストへ変換
                this.showToast(
                    warningTitle,
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

    // 確定したレコード変更を親へ通知して検索結果を更新
    async refreshRecordsAndNotifyChange() {
        // 更新済みレコードへの古い選択状態を解除
        this.selectedRowIds = [];
        // 一覧の再取得成否に依存させず確定した変更を親へ通知
        this.dispatchEvent(new CustomEvent('recordschanged'));
        // 保存・削除とは独立した再取得結果を表示
        await this.refreshRecords();
    }

    // 一覧取得の失敗を保存・削除の失敗へ伝播させず処理
    async refreshRecords() {
        // 再取得完了まで一覧操作を抑止
        this.isRefreshing = true;
        // wireの最新結果を取得して表示を更新
        try {
            // キャッシュ更新が完了するまで待機
            const firstPageResult = this.firstPageWireResult ?? this.wiredSearchResult;
            // 保存・削除・期限切れ後は古い結果集合と履歴を破棄
            this.applySearchState(createSearchCriteriaState(this.searchTerm));
            // 先頭ページのカーソルなし要求を再実行
            await refreshApex(firstPageResult);
            // 復旧後に以前の取得エラーを残さない
            this.errorTitle = undefined;
            // 正常に再取得できたことを画面へ反映
            this.errorMessage = undefined;
        } catch (error) {
            // 先頭ページへの遷移中に失敗しても利用者が再試行できるようにする
            this.isSearchPending = false;
            // 古い一覧と選択を破棄して再取得の失敗を案内
            Object.assign(this, createSearchFailureState(error));
        } finally {
            // 成否にかかわらず手動の再試行を許可
            this.isRefreshing = false;
        }
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

    // 標準モーダルへフォームを渡し、確定した変更だけ一覧へ反映
    async openRecordForm(recordId) {
        // 二重起動を拒否し、標準モーダルが戻すフォーカス先のボタンは保持
        if (this.showRecordForm) {
            return;
        }
        // レコードIDの有無でフォームの作成・編集モードを選択
        this.formRecordId = recordId;
        // 選択モードの項目と見出しを構築
        this.updateFormState();
        // モーダルの終了まで同じ画面の再起動を抑止
        this.showRecordForm = true;
        // キーボード操作とフォーカス管理をLightningModalへ委譲
        try {
            // フォーム表示時点の設定を独立したモーダルへ渡す
            const result = await ObjectRecordFormModal.open({
                size: 'large',
                label: this.formTitle,
                objectApiName: this.config.objectApiName,
                objectLabel: this.config.objectLabel,
                recordId,
                formSections: this.formSections,
                isFileUpload: this.formViewState.isFileUploadObject
            });
            // キャンセルや標準の閉じる操作では一覧を再取得しない
            if (result) {
                // 保存・アップロードの確定結果を通知
                this.showToast(result.title, result.message, 'success');
                // 再取得の失敗と保存結果を分けて親へ変更を通知
                await this.refreshRecordsAndNotifyChange();
            }
        } catch (error) {
            // モーダル起動に失敗しても利用者が再試行できるようにする
            this.showToast(
                'フォームを開けませんでした',
                reduceErrors(error, '時間をおいて再度お試しください。'),
                'error'
            );
        } finally {
            // 閉じたフォームの編集対象を次の操作へ持ち越さない
            this.formRecordId = undefined;
            // 作成モードの派生状態へ戻す
            this.updateFormState();
            // 成否にかかわらず再起動を許可
            this.showRecordForm = false;
        }
    }

    // フォーム入力元が変わった時だけwire条件と表示状態を再生成
    updateFormState() {
        // 最新入力からUI API wireへ渡す軽量状態を生成
        const nextFormWireState = createFormWireState({
            // Apexが返した対象オブジェクト設定を渡す
            config: this.config,
            // 既定レコードタイプを含むUI API応答を渡す
            objectInfoResult: this.objectInfoResult,
            // CreateまたはEditを判定するレコードIDを渡す
            formRecordId: this.formRecordId
        });
        // wire入力が変わった場合だけリアクティブ状態を差し替え
        if (
            hasFormWireInputChanged(
                this.formWireState,
                nextFormWireState
            )
        ) {
            // 同値の再代入によるUI API wireの再実行循環を防止
            this.formWireState = nextFormWireState;
        }
        // 最新のwire応答から高コストなフォーム構造を1度だけ生成
        this.formViewState = createFormViewState({
            // Apexが返した対象オブジェクト設定を渡す
            config: this.config,
            // 項目属性と権限情報を含むUI API応答を渡す
            objectInfoResult: this.objectInfoResult,
            // 作成用のページレイアウト応答を渡す
            createLayoutResult: this.createLayoutResult,
            // 編集用のページレイアウト応答を渡す
            editLayoutResult: this.editLayoutResult,
            // 作成または編集モードを判定するレコードIDを渡す
            formRecordId: this.formRecordId,
            // 最新入力から生成したフォーム方式とwire条件を渡す
            formWireState: nextFormWireState
        });
    }
}
