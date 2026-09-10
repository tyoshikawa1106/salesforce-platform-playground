import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getEmailMessageCount from '@salesforce/apex/CaseEmailMessageController.getEmailMessageCount';
import getEmailMessagePaginationCursor from '@salesforce/apex/CaseEmailMessageController.getEmailMessagePaginationCursor';
import getEmailMessages from '@salesforce/apex/CaseEmailMessageController.getEmailMessages';
import { reduceErrors } from 'c/errorUtils';
import {
    LOAD_ERROR_MESSAGE,
    createCardTitle,
    createEmptyPaginationState,
    createInitialPageState,
    createNextPageState
} from './caseEmailMessageListLogic';

// Caseレコードページにメールログをカーソルページングで表示
export default class CaseEmailMessageList extends LightningElement {
    // レコードページから表示中CaseのIDを受け取る
    _recordId;
    // ケース切り替えと初期ページ再取得を識別する世代
    paginationGeneration = 0;

    // wireとテンプレートへ現在のケースIDを公開
    @api
    get recordId() {
        // 親から設定されたケースIDを返却
        return this._recordId;
    }

    // ケース変更時に処理中の追加ページを無効化
    set recordId(value) {
        // 同じケースの再設定では取得状態を維持
        if (value === this._recordId) {
            // 不要な世代更新を省略
            return;
        }
        // 以前のケース向け応答を無効化
        this.paginationGeneration++;
        // 新しいケースをwireへ渡す
        this._recordId = value;
        // 新しいケースで以前の一覧とカーソルを使用しない
        Object.assign(this, createEmptyPaginationState());
        // 同じケースへ戻った場合も初期ページを取り直す
        this.loadedRecordId = undefined;
        // 新しいケースの初期ページが届くまで操作を待つ
        this.hasLoadedInitialPage = false;
        // 前のケースの全体エラーを破棄
        this.errorMessage = undefined;
        // 前のケースの追加取得エラーを破棄
        this.loadMoreErrorMessage = undefined;
        // 古い追加取得の完了を待たず新しいケースを操作可能にする
        this.isLoadingMore = false;
    }

    // 取得済みメールを表示順に保持
    emailMessages = [];
    // 初期取得または再取得失敗時の全体エラーを保持
    errorMessage;
    // 追加取得失敗時の一覧内エラーを保持
    loadMoreErrorMessage;
    // Caseに紐づくメールの総件数を保持
    totalEmailMessageCount = 0;
    // 次ページを取得できる状態を保持
    hasNextPage = false;
    // 追加取得へ引き継ぐSalesforce標準PaginationCursorを保持
    paginationCursor;
    // 次ページ取得を開始する0始まりの位置を保持
    nextIndex;
    // 初期ページの取得完了状態を保持
    hasLoadedInitialPage = false;
    // 初期ページ取得中の重複呼び出しを抑止
    isLoadingInitialPage = false;
    // 初期ページを反映済みのCase IDを保持
    loadedRecordId;
    // 手動再読み込み中の操作抑止状態を保持
    isRefreshing = false;
    // 追加ページ取得中の操作抑止状態を保持
    isLoadingMore = false;
    // 総件数のrefreshApexに使うwireレスポンスを保持
    wiredEmailMessageCountResult;

    // 初期ページより先にCaseのメール総件数を取得
    @wire(getEmailMessageCount, { caseId: '$recordId' })
    wiredEmailMessageCount(result) {
        // 手動再読み込みに使えるwireレスポンスを保存
        this.wiredEmailMessageCountResult = result;
        // 成功データとエラーを排他的に参照
        const { data, error } = result;

        // 0件を含む取得成功時は初期ページを命令的に取得
        if (data !== undefined) {
            // Apexの整数値をJavaScript数値へ統一
            this.totalEmailMessageCount = Number(data);
            // 再取得成功時は以前の全体エラーを解除
            this.errorMessage = undefined;
            // 手動再読み込み以外で未取得のCaseだけ初期ページを読み込む
            if (!this.isRefreshing && this.loadedRecordId !== this.recordId) {
                // 別Caseの一覧とページング状態を表示前に破棄
                Object.assign(this, createEmptyPaginationState());
                // 新しいCaseの初期ページを待つ状態へ戻す
                this.hasLoadedInitialPage = false;
                // AuraEnabled応答としてPaginationCursorを受け取る
                this.loadInitialPage();
            }
            // 件数取得失敗時は一覧を表示せず全体エラーへ移行
        } else if (error) {
            // 件数取得失敗前に開始したページ応答を無効化
            this.paginationGeneration++;
            // 無効化した追加取得の完了を待たず操作状態を解除
            this.isLoadingMore = false;
            // 件数を安全な0件へ戻す
            this.totalEmailMessageCount = 0;
            // 以前の一覧とページング状態を共通処理で破棄
            Object.assign(this, createEmptyPaginationState());
            // 件数取得が復旧した場合は同じCaseの初期ページも再取得
            this.loadedRecordId = undefined;
            // エラー応答を初期取得の完了として記録
            this.hasLoadedInitialPage = true;
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    // AuraEnabled応答として初期ページとPaginationCursorを取得
    async loadInitialPage() {
        // 件数取得失敗中はページを取得せず、進行中の初期取得も重複させない
        if (!this.recordId || this.isLoadingInitialPage || this.wiredEmailMessageCountResult?.error) {
            // 件数取得の復旧または現在の初期取得完了を待つ
            return;
        }

        // 応答先を判定するため取得開始時のCase IDを保持
        const targetRecordId = this.recordId;
        // 新しい初期一覧へ以前の追加ページを混在させない
        const generation = ++this.paginationGeneration;
        // 初期一覧の取得が追加取得に代わって操作を管理
        this.isLoadingMore = false;
        // 初期ページ取得中の重複操作を抑止
        this.isLoadingInitialPage = true;

        try {
            // AuraEnabled応答として新しいPaginationCursorを直接取得
            const paginationCursor = await getEmailMessagePaginationCursor({
                caseId: targetRecordId
            });
            // 取得したカーソルと先頭位置で初期ページを取得
            const page = await getEmailMessages({
                caseId: targetRecordId,
                paginationCursor,
                startIndex: 0
            });
            // 表示対象が変わった場合は古いCaseの応答を反映しない
            if (targetRecordId !== this.recordId || generation !== this.paginationGeneration) {
                // 新しいCaseの取得へ処理を引き継ぐ
                return;
            }
            // 行変換と次ページ状態更新をまとめて実行
            this.applyInitialPage(page, paginationCursor);
            // 初期ページを反映したCase IDを記録
            this.loadedRecordId = targetRecordId;
            // 再取得成功時は以前の全体エラーを解除
            this.errorMessage = undefined;
            // 取得失敗時は古い一覧を残さず全体エラーへ移行
        } catch (error) {
            // 表示対象が変わった場合は古いCaseのエラーを反映しない
            if (targetRecordId !== this.recordId || generation !== this.paginationGeneration) {
                // 新しいCaseの取得へ処理を引き継ぐ
                return;
            }
            // 以前の一覧とページング状態を共通処理で破棄
            Object.assign(this, createEmptyPaginationState());
            // 同じCaseで自動再試行し続けないよう取得済み対象を記録
            this.loadedRecordId = targetRecordId;
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
            // 成否にかかわらず初期取得状態を確定
        } finally {
            // 初期ページ取得中の操作抑止を解除
            this.isLoadingInitialPage = false;
            // 同じCaseの成功または失敗を取得完了として記録
            if (targetRecordId === this.recordId && generation === this.paginationGeneration) {
                // テンプレートの読込表示を終了
                this.hasLoadedInitialPage = true;
                // Case変更または件数復旧後の未取得ページへ処理を引き継ぐ
            } else if (!this.isRefreshing && this.loadedRecordId !== this.recordId) {
                // 件数取得の成否を再確認して現在のCaseの初期ページを取得
                this.loadInitialPage();
            }
        }
    }

    // 1件以上のメールを表示できるか判定
    get hasEmailMessages() {
        // 一覧の要素数をテンプレート用真偽値へ変換
        return this.emailMessages.length > 0;
    }

    // 取得状態と総件数を反映したカードタイトルを返却
    get cardTitle() {
        // 取得状態と総件数に応じたタイトル生成をLogicへ委譲
        return createCardTitle({
            // 初期ページ取得済みかどうかを渡す
            hasLoaded: this.hasLoaded,
            // 全体エラーの有無を渡す
            errorMessage: this.errorMessage,
            // COUNTで取得した総件数を渡す
            totalCount: this.totalEmailMessageCount
        });
    }

    // 初期ページが最初のレスポンスを受信したか判定
    get hasLoaded() {
        // 成功または失敗のどちらかを受信済みなら完了扱い
        return this.hasLoadedInitialPage;
    }

    // 初期取得、再取得、追加取得をまとめた操作中状態を返却
    get isBusy() {
        // いずれかの非同期処理中は重複操作を抑止
        return this.isLoading || this.isRefreshing || this.isLoadingMore;
    }

    // 初期ページのレスポンス待ち状態を判定
    get isLoading() {
        // 成功または失敗が確定していない間だけ読込中とする
        return !this.errorMessage && !this.hasLoadedInitialPage;
    }

    // 利用者操作で総件数と初期ページを再取得
    async handleRefresh() {
        // 件数wireの初期化前は整合した再取得を開始しない
        if (!this.wiredEmailMessageCountResult || this.isBusy) {
            // wire応答が届くまで再読み込みを終了
            return;
        }

        // 件数再取得の応答先を表示ケースと世代で固定
        const targetRecordId = this.recordId;
        // ケース変更後に件数取得のエラーを反映しないため世代を保持
        const generation = this.paginationGeneration;
        // 再取得完了まで操作を抑止
        this.isRefreshing = true;
        // 新しい再取得開始時に追加取得エラーを解除
        this.loadMoreErrorMessage = undefined;
        // 総件数と初期ページを順番に再取得
        try {
            // 先に総件数を最新化
            await refreshApex(this.wiredEmailMessageCountResult);
            // 続けて初期ページと新しいPaginationCursorを取得
            await this.loadInitialPage();
            // 再取得失敗時はカード全体をエラー状態へ移行
        } catch (error) {
            // ケース変更後は以前の件数取得エラーを破棄
            if (targetRecordId !== this.recordId || generation !== this.paginationGeneration) {
                // 現在ケースの取得状態を維持
                return;
            }
            // どちらかの失敗をカード全体のエラーへ反映
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
            // 成否にかかわらず操作抑止を解除
        } finally {
            // 成否にかかわらず再読み込み状態を解除
            this.isRefreshing = false;
            // 再取得中に切り替わったケースの初期ページ取得を引き継ぐ
            if (this.loadedRecordId !== this.recordId && !this.isLoadingInitialPage) {
                // 最新ケースの一覧が未取得なら初期ページを要求
                this.loadInitialPage();
            }
        }
    }

    // PaginationCursorと次indexを使ってメール一覧を追加取得
    async handleLoadMore() {
        // 次ページなしまたは処理中の場合は重複取得しない
        if (!this.hasNextPage || this.isBusy) {
            // 現在一覧を維持して追加取得を終了
            return;
        }

        // 応答先となるケースと一覧の世代を固定
        const generation = this.paginationGeneration;
        // 取得開始時のケースを保持
        const targetRecordId = this.recordId;
        // 取得開始時のカーソルを保持
        const paginationCursor = this.paginationCursor;
        // 追加取得完了まで操作を抑止
        this.isLoadingMore = true;
        // 再試行開始時は以前の追加取得エラーを解除
        this.loadMoreErrorMessage = undefined;
        // 次ページ取得と一覧追加を1つの処理単位で実行
        try {
            // 現在のPaginationCursorと次indexでApexを命令的に呼び出す
            const page = await getEmailMessages({
                // 表示中Caseだけを検索対象に指定
                caseId: targetRecordId,
                // 前回応答のPaginationCursorを引き継ぐ
                paginationCursor,
                // 前回応答の次indexから取得を再開
                startIndex: this.nextIndex
            });
            // 別ケースまたは再取得後の一覧には古い応答を反映しない
            if (generation !== this.paginationGeneration || targetRecordId !== this.recordId) {
                // 現在の一覧とページ位置を維持
                return;
            }
            // 追加ページを既存一覧へ連結した次状態をまとめて反映
            Object.assign(
                this,
                createNextPageState({
                    // Apexが返した追加ページを渡す
                    page,
                    // 現在表示中の一覧を渡す
                    emailMessages: this.emailMessages,
                    // 初回に直接取得したPaginationCursorを維持
                    paginationCursor
                })
            );
            // 追加取得失敗時は現在一覧を維持してエラーだけを表示
        } catch (error) {
            // 古い取得の失敗で現在の一覧へエラーを出さない
            if (generation !== this.paginationGeneration || targetRecordId !== this.recordId) {
                // 新しい取得の状態を維持
                return;
            }
            // 初期一覧を残したまま追加取得エラーだけを表示
            this.loadMoreErrorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
            // 成否にかかわらず追加取得の操作抑止を解除
        } finally {
            // 成否にかかわらず追加取得状態を解除
            if (generation === this.paginationGeneration) {
                // 現在世代の追加取得だけ操作抑止を解除
                this.isLoadingMore = false;
            }
        }
    }

    // Apex初期ページ応答を一覧とページング状態へ反映
    applyInitialPage(page, paginationCursor) {
        // 初期ページから生成した一覧とページング状態をまとめて反映
        Object.assign(this, createInitialPageState(page, paginationCursor));
    }
}