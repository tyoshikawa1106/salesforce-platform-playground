import { LightningElement } from 'lwc';
import TIME_ZONE from '@salesforce/i18n/timeZone';
import countMatches from '@salesforce/apex/SetupAuditTrailExplorerController.countMatches';
import countMonth from '@salesforce/apex/SetupAuditTrailExplorerController.countMonth';
import loadFilterOptions from '@salesforce/apex/SetupAuditTrailExplorerController.loadDistinctFilterOptions';
import exportAllHistory from '@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory';
import loadLoginAsHistory from '@salesforce/apex/SetupAuditTrailExplorerController.loadLoginAsHistory';
import load from '@salesforce/apex/SetupAuditTrailExplorerController.load';
import {
    CSV_HEADER, FILTER_OPTION_FIELDS, buildDateOptions, buildFilterFields, collectFilterOptions, currentMonth,
    collectLoginAsPairs, hasDelegateAsCreator, historyRow, loginAsActors, loginBucket, filterOptionGroups, formatCsvPage, mergeChartPage, needsLoginAsUser, offsetMonth, pageCursor, sortFilterOptions
} from './setupAuditTrailExplorerLogic';

// 履歴一覧で公開する項目と表示形式を定義する。
const COLUMNS = [
    { label: '日付', fieldName: 'CreatedDate', type: 'date', initialWidth: 185, typeAttributes: {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: TIME_ZONE
    }},
    { label: 'ユーザー', fieldName: 'displayedUser', initialWidth: 300, wrapText: true },
    { label: '名前空間プレフィックス', fieldName: 'ResponsibleNamespacePrefix', initialWidth: 165, wrapText: true },
    { label: 'アクション', fieldName: 'displayedAction', wrapText: true },
    { label: 'セクション', fieldName: 'Section', initialWidth: 240, wrapText: true },
    { label: '代理ユーザー', fieldName: 'displayedDelegate', initialWidth: 175, wrapText: true }
].map(column => ({
    ...column,
    hideDefaultActions: true,
    cellAttributes: { class: 'slds-text-body_small' }
}));
// 一覧のページ送りと行番号に同じ件数を使う。
const PAGE_SIZE = 1000;
// 取得済みの明細をスクロールに合わせて表へ追加する単位。
const RENDER_BATCH_SIZE = 50;
// 見出しの件数に桁区切りを付ける。
const COUNT_FORMAT = new Intl.NumberFormat('ja-JP');

// 履歴の検索・分析とCSV出力の操作を受け付ける。
export default class SetupAuditTrailExplorer extends LightningElement {
    // 履歴一覧の列構成を表に渡す。
    columns = COLUMNS;
    // 初期表示をユーザーの現在月に合わせる。
    month = currentMonth();
    // 入力中の実行ユーザー条件を保持する。
    userId = null;
    // 入力中の操作種別を保持する。
    action = null;
    // 入力中の名前空間条件を保持する。
    namespacePrefix = null;
    // 入力中の代理ユーザー条件を保持する。
    delegateUser = null;
    // 画面の表示値で照合する条件と、その確定済み検索に属する結果を保持する。
    section = null;
    matchingIds;
    screenActors;
    // 同じ画面で並行する照合要求を共有する。
    pendingActors;
    // 取得前と候補なしを区別する。
    filterOptions = null;
    // ログイン名による候補検索を可能にする。
    userOptions = {};
    // ユーザー候補の表示名を保持する。
    userNames = {};
    // 月内の代理ユーザーのログイン名を氏名に対応付ける。
    delegateNames = {};
    // 検索ボタンで確定した条件を一覧と分析で共有する。
    appliedFilters = {};
    // 開いている候補欄を識別する。
    lookupField = '';
    // 候補の絞り込みに使う入力を保持する。
    lookupTerm = '';
    // キーボードでの候補未選択を表す。
    lookupIndex = -1;
    // 候補取得の世代を識別する。
    optionsRequest = 0;
    // 候補を取得できなかった状態を表示に使う。
    optionsError = false;
    // 読み込み中の候補の重複取得を防ぐ。
    optionsLoading = false;
    // 対象月内の任意の日を指定できるようにする。
    day = null;
    // 初期表示に明細タブを使う。
    tab = 'list';
    // 表示中の明細ページを保持する。
    records = [];
    // 表の末尾へ到達するまでは現在のページの先頭だけを描画する。
    renderedRowLimit = RENDER_BATCH_SIZE;
    // 分析タブに渡す集計行を保持する。
    buckets = [];
    // 先頭ページは境界を指定せず取得する。
    pageStarts = [{}];
    // 条件に一致する件数の未取得状態を表す。
    matchCount = null;
    // 条件変更前の件数応答を識別する。
    matchRequest = 0;
    // 同じ件数の同時取得を防ぐ。
    matchLoading = false;
    // 明細を維持したまま件数だけを再取得できるようにする。
    matchCountError = false;
    // 一覧のページ番号を先頭から始める。
    page = 1;
    // 明細取得前と取得済みの空一覧を区別する。
    listReady = false;
    // 分析取得前と集計結果なしを区別する。
    chartReady = false;
    // 一覧・分析の読み込み表示を管理する。
    loading = false;
    // 履歴取得のエラーを画面に渡す。
    error = '';
    // 一覧・分析の最新の要求を識別する。
    request = 0;
    // 出力の中断後に届く応答を識別する。
    exportRequest = 0;
    // 複数のCSV出力の同時開始を防ぐ。
    exporting = false;
    // CSV固有の失敗を履歴表示と別に扱う。
    exportError = '';
    // 出力ページの累積件数を進捗表示に使う。
    exportedRows = 0;
    // ダウンロードに使ったBlobを後から解放できるようにする。
    downloadUrl;
    // 対象月の総件数が未確定の状態を区別する。
    monthTotal = null;
    // 月別件数の取得中に状態を表示する。
    monthTotalLoading = false;
    // 月別件数の失敗を一覧の失敗と区別する。
    monthTotalError = false;
    // 月の切り替え前の件数応答を識別する。
    countRequest = 0;

    // 表示開始時に当月の履歴を取得する。
    connectedCallback() {
        // 画面サイズ変更に一覧の高さを追従させる。
        window.addEventListener('resize', this.fitHistoryViewport);
        // 月の総件数を一覧と並行して取得する。
        this.readMonthTotal();
        // 表示中の条件で履歴を読み込む。
        this.refresh();
    }

    // 離脱前の要求が再表示後の状態に影響しないようにする。
    disconnectedCallback() {
        // 表示を終えた画面のサイズ監視を解除する。
        window.removeEventListener('resize', this.fitHistoryViewport);
        // 離脱前の代理ログイン照合を打ち切る。
        this.pendingActors = undefined;
        // 離脱前の履歴応答を無効にする。
        this.request += 1;
        // 離脱前の月別件数を無効にする。
        this.countRequest += 1;
        // 月別件数の再取得を可能にする。
        this.monthTotalLoading = false;
        // 離脱前の候補取得を無効にする。
        this.optionsRequest += 1;
        // 候補の再取得を可能にする。
        this.optionsLoading = false;
        // 離脱前の絞り込み件数を無効にする。
        this.matchRequest += 1;
        // 絞り込み件数の再取得を可能にする。
        this.matchLoading = false;
        // 進行中のCSVページを破棄対象にする。
        this.exportRequest += 1;
        // 再表示時の出力を可能にする。
        this.exporting = false;
        // 表示中に作成したダウンロードURLを解放する。
        this.releaseDownload();
    }

    // 以前のCSVがメモリに残り続けないようにする。
    releaseDownload() {
        // ダウンロードURLが発行された場合だけ解放する。
        if (this.downloadUrl) {
            // 対応するBlobをブラウザーが解放できるようにする。
            URL.revokeObjectURL(this.downloadUrl);
            // 解放済みのURLを再利用しないようにする。
            this.downloadUrl = undefined;
        }
    }

    // 表示月からApexに渡す開始日を求める。
    get monthDate() {
        // 月の初日を日付形式で返す。
        return this.month + '-01';
    }

    // 取得の途中経過を表示する。
    get exportProgress() {
        // 完了済みのページだけを件数に含める。
        return 'CSVを作成中（' + this.exportedRows + '件取得済み）';
    }

    // 絞り込みが確定しているか判定する。
    get hasFilters() {
        // 未指定の条件を除いて検索条件の有無を調べる。
        return Object.values(this.appliedFilters).some(Boolean);
    }

    // ページ数の算出に使う件数を選ぶ。
    get resultCount() {
        // 検索中は一致件数、月全体なら月別件数を使う。
        return this.hasFilters ? this.matchCount : this.monthTotal;
    }

    // 最終ページの番号を求める。
    get totalPages() {
        // 件数が確定した場合だけ端数を含むページ数を返す。
        return this.resultCount === null ? null : Math.ceil(this.resultCount / PAGE_SIZE);
    }

    // 一覧のページ位置を利用者に伝える。
    get pageSummary() {
        // 最初のページが空なら総ページ数もゼロとする。
        if (this.emptyList && this.page === 1) {
            // 履歴がないことをページ数に反映する。
            return '0 / 0ページ';
        }
        // 読み込んだ最終ページは、別の時点で取得した月別件数より優先する。
        if (this.listReady && this.records.length && !this.hasNextPage) {
            // 最終ページの位置から総ページ数を確定する。
            return this.page + ' / ' + this.page + 'ページ';
        }
        // カーソルで到達できる範囲より小さい総ページ数は表示しない。
        const minimumPages = this.page + (this.hasNextPage ? 1 : 0);
        // 件数が未確定または明細と矛盾する間は現在位置のみ表示する。
        return this.totalPages >= minimumPages ? this.page + ' / ' + this.totalPages + 'ページ' : this.page + 'ページ';
    }

    // 現在のページのうちスクロール済みの範囲を表に渡す。
    get visibleRecords() {
        // 全件表示後は取得済みの配列をそのまま使う。
        return this.hasMoreRows ? this.records.slice(0, this.renderedRowLimit) : this.records;
    }

    // 次ページへ進む前に描画できる取得済み明細があるかを判定する。
    get hasMoreRows() {
        return this.renderedRowLimit < this.records.length;
    }

    // 表の末尾では、通信せずに同じページの続きを表示する。
    showMoreRows() {
        // 端数のページでも取得済み件数を上限にする。
        this.renderedRowLimit = Math.min(this.records.length, this.renderedRowLimit + RENDER_BATCH_SIZE);
    }

    // 行番号を前のページから連続させる。
    get rowNumberOffset() {
        // 現在ページより前にある行数を求める。
        return (this.page - 1) * PAGE_SIZE;
    }

    // 次ページへの移動可否を求める。
    get hasNextPage() {
        // 取得済みの境界が次ページにあるか確認する。
        return this.canOpenPage(this.page + 1);
    }

    // 前ページへの移動可否を求める。
    get hasPreviousPage() {
        // 先頭より前への移動を防ぐ。
        return this.canOpenPage(this.page - 1);
    }

    // 指定ページを取得できるか調べる。
    canOpenPage(page) {
        // 取得済みのページ境界内に移動先を限定する。
        return page >= 1 && page <= (this.matchingIds ? this.totalPages : this.pageStarts.length);
    }

    // 読み込み後の空一覧を識別する。
    get emptyList() {
        // 明細取得が完了した場合だけ空表示にする。
        return this.listReady && !this.records.length;
    }

    // 分析完了後の空結果を識別する。
    get chartEmpty() {
        // 集計完了後に結果がない場合だけ空表示にする。
        return this.chartReady && !this.buckets.length;
    }

    // 表示月と月全体の件数を見出しにする。
    get monthHeading() {
        // 月選択値から年と月を取り出す。
        const [year, month] = this.month.split('-');
        // 月を日本語表記に整える。
        const heading = year + '年' + Number(month) + '月';
        // 確定した件数だけを見出しに添える。
        return this.monthTotal === null ? heading : heading + '（' + COUNT_FORMAT.format(this.monthTotal) + '件）';
    }

    // 月移動の下限を判定する。
    get previousMonthDisabled() {
        // 現在月から六か月前まで移動を許可する。
        return this.month <= offsetMonth(currentMonth(), -6);
    }

    // 月移動の上限を判定する。
    get nextMonthDisabled() {
        // 現在月より先への移動を無効にする。
        return this.month >= currentMonth();
    }

    // 月移動ボタンの向きを対象月に反映する。
    moveMonth(event) {
        // 操作されたボタンから移動方向を読み取る。
        const offset = Number(event.currentTarget.dataset.step);
        // 保持期間を探すための月選択範囲に収める。
        if ((offset === -1 && !this.previousMonthDisabled) || (offset === 1 && !this.nextMonthDisabled)) {
            // 移動先を起点に画面を更新する。
            this.setMonth(offsetMonth(this.month, offset));
        }
    }

    // 対象月に依存する検索状態を切り替える。
    setMonth(month) {
        // すでに表示中の月かを確認する。
        if (month === this.month) {
            // 同じ月の再取得を避ける。
            return;
        }
        // 新しい月を以後の検索に使う。
        this.month = month;
        // 編集中の旧条件を取り除く。
        this.resetFilterValues();
        // 検索済み条件を月の切り替えで解除する。
        this.appliedFilters = {};
        // 新しい月の見出し件数を取得する。
        this.readMonthTotal();
        // 新しい月には以前の氏名を引き継がない。
        this.userNames = {};
        // 代理ユーザーの表示名も新しい月から取得する。
        this.delegateNames = {};
        // 新しい月の先頭から履歴を表示する。
        this.refresh();
    }

    // 月別件数を最新の見出しへ反映する。
    async readMonthTotal() {
        // 今回の月別件数要求を識別する。
        const request = ++this.countRequest;
        // 件数が確定するまで取得中とする。
        this.monthTotalLoading = true;
        // 前の月の件数が表示されないようにする。
        this.monthTotal = null;
        // 前回の件数取得エラーを取り下げる。
        this.monthTotalError = false;
        try {
            // 表示月の全件数を問い合わせる。
            const total = await countMonth({ monthStart: this.monthDate });
            // 表示月が変わっていない場合に採用する。
            if (request === this.countRequest) {
                // 見出しに取得済み件数を渡す。
                this.monthTotal = total;
            }
        } catch {
            // 旧月の失敗で新しい月をエラーにしない。
            if (request === this.countRequest) {
                // 件数取得の失敗を表示する。
                this.monthTotalError = true;
            }
        } finally {
            // 現在の要求だけが取得中表示を終了できるようにする。
            if (request === this.countRequest) {
                // 月別件数の取得中表示を外す。
                this.monthTotalLoading = false;
            }
        }
    }

    // 対象月に記録された候補だけを取得し、月切り替え前の応答は破棄する。
    async readFilterOptions() {
        // 同時取得と取得済み候補の再読み込みを避ける。
        if (this.optionsLoading || this.filterOptions) {
            // 利用できる候補または取得中の要求を使う。
            return;
        }
        // 今回の候補要求を識別する。
        const request = ++this.optionsRequest;
        // 前回の候補エラーを取り下げる。
        this.optionsError = false;
        // 候補の重複読み込みを防ぐ。
        this.optionsLoading = true;
        // 項目別に重複のない候補を集める。
        const groups = filterOptionGroups();
        // ユーザーIDとログイン名の対応を集める。
        const users = {};
        // ユーザーIDと表示名の対応を集める。
        const names = {};
        const delegateNames = {};
        // 補正後のユーザーをID単位で保持し、取得済みの明細ページを解放する。
        const loginUsers = new Map();
        // 全ページで同じ月を使う。
        const monthStart = this.monthDate;
        // 最初の候補ページから始める。
        let cursor = {};
        try {
            // 候補の続きがある間は順番に読み込む。
            do {
                // 次の候補ページには直前のカーソルが必要。
                // eslint-disable-next-line no-await-in-loop
                const result = await loadFilterOptions({ monthStart, ...cursor });
                // 月切り替えや離脱後の応答を識別する。
                if (request !== this.optionsRequest) {
                    // 無効になった候補の反映を止める。
                    return;
                }
                // 項目別に候補をまとめる。
                for (const field of FILTER_OPTION_FIELDS) {
                    // このページが返した各値を取り込む。
                    for (const value of (result.options[field] ?? [])) {
                        // 複数ページに現れる候補を一つにまとめる。
                        groups[field].add(value);
                    }
                }
                // ログイン名をページ間で統合する。
                Object.assign(users, result.userOptions);
                // 表示名をページ間で統合する。
                Object.assign(names, result.userNames);
                Object.assign(delegateNames, result.delegateNames);
                // 代理ログインはこのページのうちにユーザー候補へ変換する。
                if (result.records?.length) {
                    // 必要な場合だけ画面で共有する照合結果を待つ。
                    // eslint-disable-next-line no-await-in-loop
                    const actors = await this.actorsForLogins(result.records);
                    if (request !== this.optionsRequest) {
                        return;
                    }
                    for (const row of result.records) {
                        const actor = actors?.get(row.Id) ?? row;
                        if (actor.CreatedById && actor.CreatedBy?.Username) {
                            loginUsers.set(actor.CreatedById, actor.CreatedBy);
                        }
                    }
                }
                // 次ページの開始境界を引き継ぐ。
                cursor = pageCursor(result);
            } while (cursor.nextId);
            // 通常履歴と重なるIDには、従来と同じ順で照合済みの候補を適用する。
            for (const [id, user] of loginUsers) {
                users[id] = user.Username;
                // 氏名が空でも選択後にログイン名を表示できるようにする。
                names[id] = user.Name || user.Username;
            }
            // 全ページで見つかったユーザーを検索可能にする。
            this.userOptions = users;
            // 候補から外れた選択済みユーザーの表示名も保持する。
            this.userNames = { ...this.userNames, ...users, ...names };
            this.delegateNames = delegateNames;
            // 並べ替えた候補をまとめて公開する。
            this.filterOptions = sortFilterOptions(groups);
        } catch {
            // 現在の候補要求の失敗だけを反映する。
            if (request === this.optionsRequest) {
                // 候補取得の再試行が必要な状態を示す。
                this.optionsError = true;
            }
        } finally {
            // 新たな要求の取得中表示を保護する。
            if (request === this.optionsRequest) {
                // 候補取得の待機状態を終了する。
                this.optionsLoading = false;
            }
        }
    }

    // 日付の入力欄に選択中の値を渡す。
    get selectedDay() {
        // 未指定時は「すべて」に対応する値を返す。
        return this.day || '';
    }

    // 表示月に対応する日付の候補を渡す。
    get dateOptions() {
        // 月境界を日付候補と共通の基準にする。
        return buildDateOptions(this.monthDate);
    }

    // 選択状態と候補の取得状態を各検索欄に反映する。
    get filterFields() {
        // 入力中の条件を、確定済みの検索条件とは独立して表示する。
        return buildFilterFields({
            userOptions: this.userOptions, userNames: this.userNames, delegateNames: this.delegateNames, filterOptions: this.filterOptions,
            selectedValues: { userId: this.userId, namespacePrefix: this.namespacePrefix, action: this.action, section: this.section, delegateUser: this.delegateUser },
            lookupField: this.lookupField, lookupTerm: this.lookupTerm, lookupIndex: this.lookupIndex
        });
    }

    // 操作中の欄の候補一覧を開く。
    openLookup(event) {
        // 入力欄から対象項目を識別する。
        const field = event.currentTarget.dataset.field;
        if (this[field]) {
            return;
        }
        // 別の検索欄へ移ったかを判定する。
        if (field !== this.lookupField) {
            // 対象の項目だけを展開する。
            this.lookupField = field;
            // 前の欄の検索文字を引き継がないようにする。
            this.lookupTerm = '';
            // 移動先の候補を未選択にする。
            this.lookupIndex = -1;
        }
        // 失敗状態では暗黙の再取得を避ける。
        if (!this.optionsError) {
            // 初めて必要になった候補を読み込む。
            this.readFilterOptions();
        }
    }

    // 入力文字で候補の一覧を更新する。
    searchFilterOptions(event) {
        // 対象欄の候補を開く。
        this.openLookup(event);
        // 現在の入力を検索条件に使う。
        this.lookupTerm = event.target.value;
        // 新しい候補の先頭から移動できるようにする。
        this.lookupIndex = -1;
    }

    // 入力中の検索状態を閉じる。
    closeLookup() {
        // 開いている欄の指定を外す。
        this.lookupField = '';
        // 一時的な候補検索文字を取り除く。
        this.lookupTerm = '';
        // キーボードの選択位置を解除する。
        this.lookupIndex = -1;
    }

    // 同じ欄内の解除・再取得ボタンへ移動する間は候補を維持する。
    leaveLookup(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            this.closeLookup();
        }
    }

    // 再取得ボタンが消えても入力欄で候補を選べるようにする。
    retryLookupOptions(event) {
        this.lookupToFocus = event.currentTarget.dataset.field;
        this.readFilterOptions();
    }

    // マウスで選ぶ間は入力欄にフォーカスを保つ。
    keepLookupFocus(event) {
        // 候補のクリック前にフォーカスが外れるのを防ぐ。
        if (event.target.closest('[role="option"]')) {
            event.preventDefault();
        }
    }

    // キーボードで候補を移動・確定する。
    handleLookupKey(event) {
        // IMEの変換確定を候補選択に使わない。
        if (event.isComposing) {
            // 文字入力が完了するまで操作を保留する。
            return;
        }
        if (event.currentTarget.readOnly) {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                this.clearLookupSelection(event);
            }
            return;
        }
        // 開いている候補をEscで閉じる。
        if (event.key === 'Escape' && this.lookupField) {
            // ブラウザー既定のEsc処理を抑える。
            event.preventDefault();
            // 入力中の候補検索を終了する。
            this.closeLookup();
        // 矢印の方向に候補を移動する。
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // 矢印キーによるページスクロールを抑える。
            event.preventDefault();
            // 移動対象の候補を表示する。
            this.openLookup(event);
            // 展開中の欄の候補を取得する。
            const field = this.filterFields.find(item => item.key === this.lookupField);
            // 移動可能な候補があるかを確認する。
            if (!field.options.length) {
                // 空の一覧で選択位置を作らないようにする。
                return;
            }
            // 押された方向を候補位置の増減に変換する。
            const step = event.key === 'ArrowDown' ? 1 : -1;
            // 未選択時の上移動は末尾から始める。
            const index = this.lookupIndex < 0 && step < 0 ? field.options.length - 1 : this.lookupIndex + step;
            // 移動先を候補一覧の範囲に収める。
            this.lookupIndex = Math.max(0, Math.min(index, field.options.length - 1));
        // 選択位置がある場合だけEnterで確定する。
        } else if (event.key === 'Enter' && this.lookupField && this.lookupIndex >= 0) {
            // 候補確定にEnterを使う。
            event.preventDefault();
            // 確定対象の欄を探す。
            const field = this.filterFields.find(item => item.key === this.lookupField);
            // 現在の位置に対応する候補を取り出す。
            const option = field.options[this.lookupIndex];
            // 再描画後も候補が存在するか確認する。
            if (option) {
                // 選択した候補を検索条件に渡す。
                this.applyFilter(field.key, option.value);
            }
        }
    }

    // 表示後の高さと候補のスクロールを同期する。
    renderedCallback() {
        // 本文の表示位置に高さを合わせる。
        this.fitHistoryViewport();
        // 選択の解除後は同じ入力欄で続けて候補を選べるようにする。
        if (this.lookupToFocus) {
            const input = this.template.querySelector(`input[data-field="${this.lookupToFocus}"]`);
            this.lookupToFocus = null;
            input?.focus();
        }
        // キーボードで候補を移動した場合に位置を調整する。
        if (this.lookupIndex >= 0) {
            // 選択した候補が一覧内に見えるようにする。
            this.template.querySelector('.slds-has-focus[role="option"]')?.scrollIntoView?.({ block: 'nearest' });
        }
    }

    // 表自体に一画面を使えるよう、Salesforce の本文が始まる位置だけを高さから除く。
    fitHistoryViewport = () => {
        const main = this.template.querySelector('main');
        // 非表示のコンポーネントでは本文の開始位置を計測できない。
        if (!main?.getClientRects().length) {
            return;
        }
        // 文書座標で計測し、検索条件の高さやページのスクロール量で表の高さが変わるのを防ぐ。
        const inset = Math.ceil(main.getBoundingClientRect().top + window.scrollY);
        main.style.setProperty('--c-history-page-inset', Math.max(0, inset) + 'px');
    };

    // クリックした候補を入力中の条件に反映する。
    selectLookupOption(event) {
        // 候補が属する検索欄に選択値を設定する。
        this.applyFilter(this.lookupField, event.currentTarget.dataset.value);
    }

    // 選択を解除したあとも検索を押すまで確定済みの条件を保持する。
    clearLookupSelection(event) {
        // 候補を空にし、未指定の条件へ戻す。
        this.lookupToFocus = event.currentTarget.dataset.field;
        this.applyFilter(this.lookupToFocus, null);
    }

    // 日付欄の選択を検索条件に渡す。
    changeFilter(event) {
        // 項目と選択値の組を反映する。
        this.applyFilter(event.currentTarget.dataset.field, event.detail.value);
    }

    // 確定前の入力条件を更新する。
    applyFilter(field, selected) {
        // 候補選択後に一覧を閉じる。
        this.closeLookup();
        // 選択解除を未指定値に揃える。
        this[field] = selected || null;
    }

    // 月変更時に入力中の条件をまとめて取り除く。
    resetFilterValues() {
        // 旧月の候補一覧を閉じる。
        this.closeLookup();
        // ユーザーを指定しない状態に戻す。
        this.userId = null;
        // 名前空間を指定しない状態に戻す。
        this.namespacePrefix = null;
        // 操作種別を指定しない状態に戻す。
        this.action = null;
        // 代理ユーザーを指定しない状態に戻す。
        this.delegateUser = null;
        this.section = null;
        // 日の指定を外して月全体を対象にする。
        this.day = null;
    }

    // 編集中の条件を確定し、履歴と分析が同じ条件を使うようにする。
    search() {
        // 候補一覧を閉じて検索結果の表示に移る。
        this.closeLookup();
        // 入力値を今回の検索条件として固定する。
        this.appliedFilters = {
            day: this.day,
            userId: this.userId,
            action: this.action,
            ...(this.section ? { section: this.section } : {}),
            ...(this.namespacePrefix ? { namespacePrefix: this.namespacePrefix } : {}),
            ...(this.delegateUser ? { delegateUser: this.delegateUser } : {})
        };
        // 全件検索では見出しとページ数も今回の履歴に合わせる。
        if (!this.hasFilters) {
            // 一覧と並行して月全体の件数を更新する。
            this.readMonthTotal();
        }
        // 確定した条件で一覧と分析を再読み込みする。
        return this.refresh();
    }

    // タブ切り替えに応じて必要な結果を取得する。
    activateTab(event) {
        // 選択されたタブを識別する。
        const selected = event.target.value;
        // 同じタブの再取得を避ける。
        if (selected && selected !== this.tab) {
            // 選択された表示に切り替える。
            this.tab = selected;
            // 選択したタブの内容を取得する。
            this.read();
        }
    }

    // 集計行から対応する明細へ移動する。
    selectBucket(event) {
        // 確定済みの条件に選択した集計軸を重ねる。
        const { userId, action, day, namespacePrefix, section, delegateUser } = { ...this.appliedFilters, ...event.detail };
        // 候補を未取得でも、選択した棒のユーザー名を明細の検索欄に表示する。
        if (event.detail.userId && event.detail.userName) {
            // ユーザーIDと表示名を一緒に引き継ぐ。
            this.userNames = { ...this.userNames, [event.detail.userId]: event.detail.userName };
        }
        // 集計対象のユーザーを明細条件に渡す。
        this.userId = userId ?? null;
        // 集計対象の操作種別を引き継ぐ。
        this.action = action ?? null;
        // 集計対象の日を明細条件に渡す。
        this.day = day ?? null;
        // 名前空間で区別された集計を引き継ぐ。
        this.namespacePrefix = namespacePrefix ?? null;
        // 代理ユーザーで区別された集計を引き継ぐ。
        this.delegateUser = delegateUser ?? null;
        this.section = section ?? null;
        // 集計に対応する明細タブを開く。
        this.tab = 'list';
        // 集計行の条件を確定して明細を読み込む。
        this.search();
    }

    // 月と絞り込み条件をApexに渡す形式にする。
    get searchCriteria() {
        // 未指定値を補ったうえで確定条件を適用する。
        return { monthStart: this.monthDate, day: null, userId: null, action: null, ...this.appliedFilters };
    }

    // 一覧または分析で確定した件数を公開し、以前に開始した件数要求を無効にする。
    setResultCount(count) {
        this.matchRequest += 1;
        this.matchLoading = false;
        this.matchCount = count;
        // 明細や集計で件数が確定したら再試行の案内を閉じる。
        this.matchCountError = false;
    }

    // ページ番号表示用の一致件数を取得する。
    async readMatchCount() {
        // 照合済みIDの件数と月全体の件数は、それぞれ既存の取得結果を使う。
        if (this.usesMatchIndex || !this.hasFilters) {
            return;
        }
        // 最終ページでは境界から確定した件数を使い、先に開始した件数照会を無効にする。
        if (!this.hasNextPage) {
            this.setResultCount(this.rowNumberOffset + this.records.length);
            return;
        }
        // 分析後に新しい履歴が増えた場合は、現在の明細と矛盾する件数を再取得する。
        const minimum = this.rowNumberOffset + this.records.length + (this.hasNextPage ? 1 : 0);
        if (this.matchLoading || (this.matchCount !== null && this.matchCount >= minimum)) {
            return;
        }
        // 検索条件ごとの件数要求を識別する。
        const request = ++this.matchRequest;
        // 同じ条件での重複要求を防ぐ。
        this.matchLoading = true;
        // 新しい取得が完了するまで再試行を重ねない。
        this.matchCountError = false;
        try {
            // 確定した条件の一致件数を取得する。
            const count = await countMatches({ criteriaJson: JSON.stringify(this.searchCriteria) });
            // 要求後に検索条件が変わっていないか確認する。
            if (request === this.matchRequest) {
                // 最新の一致件数をページ表示に渡す。
                this.matchCount = count;
            }
        } catch {
            // 旧条件の失敗を現在のページへ表示しない。
            if (request === this.matchRequest) {
                // 明細は操作可能なまま、件数だけを再取得できるようにする。
                this.matchCount = null;
                this.matchCountError = true;
            }
        } finally {
            // 新しい件数取得が続いている場合は待機表示を維持する。
            if (request === this.matchRequest) {
                // 最新の件数取得を終了する。
                this.matchLoading = false;
            }
        }
    }

    // 新しい条件で先頭から取得し直す。
    refresh() {
        // 以前の検索で開始した候補取得を無効にする。
        this.optionsRequest += 1;
        // 次に欄を開いたときは、今回の月の候補を先頭から取得する。
        this.filterOptions = null;
        // ユーザーの表示名は保持し、再取得前のログイン名を候補に出さない。
        this.userOptions = {};
        // 直前の取得が失敗していても、新しい検索では候補を要求できる。
        this.optionsError = false;
        // 無効にした要求の完了を待たず、次の候補取得を許可する。
        this.optionsLoading = false;
        // 以前の代理操作の照合結果が新しい検索に反映されるのを防ぐ。
        this.pendingActors = undefined;
        // 確定した条件で対象の履歴を照合し直す。
        this.matchingIds = undefined;
        this.screenActors = undefined;
        // 以前の明細を取得済みと扱わないようにする。
        this.listReady = false;
        // 以前の分析結果を取得済みと扱わないようにする。
        this.chartReady = false;
        // 以前の検索行を取り下げる。
        this.records = [];
        // 以前の集計結果を取り下げる。
        this.buckets = [];
        // 新しい条件の先頭ページに戻す。
        this.pageStarts = [{}];
        // 以前の条件の件数応答を無効にする。
        this.matchRequest += 1;
        // 旧条件の件数エラーを取り下げる。
        this.matchCountError = false;
        // 新しい一致件数を取得可能にする。
        this.matchLoading = false;
        // 件数を未確定に戻す。
        this.matchCount = null;
        // 表示ページを先頭に戻す。
        this.page = 1;
        // 表示タブに必要なデータを読み込む。
        return this.read();
    }

    // 一覧を次ページへ移す。
    nextPage() {
        // 次ページの取得を要求する。
        this.goToPage(this.page + 1);
    }

    // 一覧を前ページへ戻す。
    previousPage() {
        // 前ページの取得を要求する。
        this.goToPage(this.page - 1);
    }

    // 取得可能なページへの移動を受け付ける。
    goToPage(page) {
        // 同時移動と取得不能なページを除く。
        if (this.loading || page === this.page || !this.canOpenPage(page)) {
            // 表示中の位置を維持する。
            return;
        }
        // 移動先を表示ページに設定する。
        this.page = page;
        // 移動先の明細が届くまで未取得にする。
        this.listReady = false;
        // 保持した境界から移動先を読み込む。
        this.read();
    }

    // ページ送りに使う境界を保存する。
    rememberNextPage(cursor) {
        // すでに記録された次ページの境界を調べる。
        const previous = this.pageStarts[this.page];
        // 同じ境界を再取得したかを判定する。
        if (previous?.nextId === cursor.nextId && previous?.nextTime === cursor.nextTime) {
            // 記録済みのページ位置を維持する。
            return;
        }
        // 現在ページより後の古い境界を除く。
        const starts = this.pageStarts.slice(0, this.page);
        // 続きがある場合だけ移動先を追加する。
        if (cursor.nextId) {
            // 次ページの開始位置を保存する。
            starts.push(cursor);
        }
        // 有効な境界だけをページ送りに使う。
        this.pageStarts = starts;
    }

    // 一時的な通信エラー時は同じCSVページを一度再取得する。
    async readExportPage(fetchPage, query, isCurrent) {
        try {
            // 指定された境界から履歴を取得する。
            return await fetchPage(query);
        } catch (error) {
            // 離脱後の要求と一時的通信エラー以外を再試行から除く。
            if (!isCurrent() || ![0, 502, 503, 504].includes(error?.status)) {
                // 元のエラーを出力処理へ伝える。
                throw error;
            }
            // 同じ取得条件を使って失敗したページだけを再試行する。
            return fetchPage(query);
        }
    }

    // 代理ログインを初めて含む明細ページでだけ照合を開始する。
    async readCsvPage(fetchPage, query, request, context) {
        // 月別・全期間の既存のページ境界と再試行を共通で使う。
        const isCurrent = () => request === this.exportRequest;
        const page = await this.readExportPage(fetchPage, query, isCurrent);
        // 離脱後や照合済みの出力では追加の要求を送らない。
        if (request === this.exportRequest && !context.actors && page.records.some(needsLoginAsUser)) {
            // 出力ごとに独立した照合結果を全明細ページで共有する。
            // 全期間では明細と同じ上限、月別では組織時刻を使って月外も照合する。
            context.actors = await this.readActors(page.cutoff, isCurrent);
        }
        // 明細の追加前に呼び出し元で要求の有効性を再確認する。
        return page;
    }

    // 分析・候補用の代理ログインには本文がないため、作成者だけで照合要否を判定する。
    actorsForLogins(logins) {
        // 作成者が既に判明している行だけなら保持期間全体の取得を省く。
        return this.screenActors ?? (logins.some(hasDelegateAsCreator) ? this.readScreenActors() : undefined);
    }

    // 一覧・候補・分析は同じ照合要求を待ち、CSVは出力開始時点の上限を個別に使う。
    readScreenActors() {
        if (!this.pendingActors) {
            // 月切替や離脱後は、先に届いた旧要求が新しい照合結果やロックを書き換えないようにする。
            const request = {};
            this.pendingActors = request;
            const isCurrent = () => this.pendingActors === request;
            request.promise = this.readActors(null, isCurrent).then(actors => {
                if (isCurrent()) {
                    this.screenActors = actors;
                }
                return actors;
            }).finally(() => {
                // 通信に失敗しても次の画面操作で再照合できるようにする。
                if (isCurrent()) {
                    this.pendingActors = undefined;
                }
            });
        }
        return this.pendingActors.promise;
    }

    // 保持期間全体でログインとログアウトを照合し、完了した結果だけを返す。
    async readActors(cutoff, isCurrent) {
        const pairs = new Map();
        let query = { cutoff: cutoff ?? null };
        do {
            // 次ページは直前の応答で確定した上限と境界で取得する。
            // eslint-disable-next-line no-await-in-loop
            const page = await this.readExportPage(loadLoginAsHistory, query, isCurrent);
            if (!isCurrent()) {
                return undefined;
            }
            collectLoginAsPairs(pairs, page.records);
            query = { cutoff: page.cutoff, ...pageCursor(page) };
        } while (query.nextId);
        return loginAsActors(pairs);
    }

    // セクションまたは代理ログイン補正を含み得るユーザー検索だけが照合を必要とする。
    get usesMatchIndex() {
        const { section, userId, action } = this.appliedFilters;
        return Boolean(section || (userId && (!action || action === 'suOrgAdminLogin')));
    }

    // セクション照合用に本文を取得せず、一致した履歴IDだけを作成日時順に保持する。
    async readMatchingIds(query, isCurrent) {
        const ids = [];
        let cursor = {};
        do {
            // 一致がない元ページでも返された境界から続ける。
            // eslint-disable-next-line no-await-in-loop
            const page = await load({ criteriaJson: JSON.stringify({ ...query, ...cursor, matchIndex: true }) });
            if (!isCurrent()) {
                return ids;
            }
            if (query.userId && !this.screenActors && page.records.some(row => row.Action === 'suOrgAdminLogin')) {
                // 照合が必要な最初のページだけ、画面内の共通要求を待つ。
                // eslint-disable-next-line no-await-in-loop
                await this.readScreenActors();
                if (!isCurrent()) {
                    return ids;
                }
            }
            for (const row of page.records) {
                const userId = this.screenActors?.get(row.Id)?.CreatedById ?? row.CreatedById;
                if (!query.userId || userId === query.userId) {
                    ids.push(row.Id);
                }
            }
            cursor = pageCursor(page);
        } while (cursor.nextId);
        return ids;
    }

    // 照合した利用者と代理ユーザーの氏名を履歴一覧に表示する。
    async showDetailPage(result, cursor, isCurrent) {
        // 保持期限などで移動先が空になった場合は、有効な境界を先頭から取り直す。
        if (this.page > 1 && !result.records.length) {
            // 見出しも同じ時点の月別件数へ合わせる。
            this.readMonthTotal();
            // 確定済みの条件を保ち、古いページ位置と照合済みIDを破棄する。
            await this.refresh();
            // 空になったページの応答を新しい一覧へ反映しない。
            return;
        }
        if (!this.screenActors && result.records.some(needsLoginAsUser)) {
            await this.readScreenActors();
            if (!isCurrent()) {
                return;
            }
        }
        const employees = new Set(result.employeeActorIds);
        // ページを開くたびに表示範囲を先頭へ戻す。
        this.renderedRowLimit = RENDER_BATCH_SIZE;
        this.records = result.records.map(row => historyRow(row, employees, this.screenActors, result.delegateNames));
        if (!this.usesMatchIndex) {
            this.rememberNextPage(cursor);
        }
        this.listReady = true;
        // 明細の境界が確定してから不足する件数だけを取得する。
        this.readMatchCount();
    }

    // 表示月の全履歴をCSVにする。
    exportMonth() {
        // 出力を開始した時刻で月別CSVを識別する。
        const fileName = 'SetupAuditTrailMonthly' + Date.now() + '.csv';
        // 月の初日だけを取得条件にして画面の絞り込みから独立させる。
        return this.exportCsv(fileName, query => load({ criteriaJson: JSON.stringify(query) }), { monthStart: this.monthDate, csv: true });
    }

    // メニューから全期間出力を受け付ける。
    selectExportOption(event) {
        // 選択された項目が全期間出力か確認する。
        if (event.detail.value === 'all') {
            // 出力操作時の端末時刻でファイル名を決める。
            const fileName = 'SetupAuditTrailAll' + Date.now() + '.csv';
            // 初回の取得上限はSalesforce側で決定する。
            return this.exportCsv(fileName, exportAllHistory, { cutoff: null });
        }
        // 対応する出力操作がない場合は終了する。
        return undefined;
    }

    // 各ページを結合して一つのダウンロードを作る。
    async exportCsv(fileName, fetchPage, query) {
        // ほかのCSV出力が進行中か確認する。
        if (this.exporting) {
            // 同時に二つのダウンロードを開始しないようにする。
            return;
        }
        // 今回の出力要求を識別する。
        const request = ++this.exportRequest;
        // UTF-8のBOMと列名をファイルの先頭に置く。
        const chunks = ['\uFEFF', CSV_HEADER];
        // 今回の出力だけで使う作成者の照合結果を保持する。
        let employeeActorIds = new Set();
        // 代理ログインの照合結果はこの出力が終了するまで共有する。
        const context = {};
        // 最初のページは境界を指定しない。
        let cursor = {};
        // 取得完了まで追加の出力操作を止める。
        this.exporting = true;
        // 前回の出力エラーを取り下げる。
        this.exportError = '';
        // 現在の出力の進捗をゼロから数える。
        this.exportedRows = 0;
        try {
            // 返された境界を使って全ページを順に取得する。
            do {
                // 次のページは直前の応答が返す境界から取得する。
                // eslint-disable-next-line no-await-in-loop
                const result = await this.readCsvPage(fetchPage, { ...query, ...cursor }, request, context);
                // 離脱後のページが届いたかを確認する。
                if (request !== this.exportRequest) {
                    // 中断済みのCSVの生成を終了する。
                    return;
                }
                // 先頭ページの根拠を後続ページでも引き継ぐ。
                if (result.employeeActorIds) {
                    // 作成者IDの照合で履歴ごとの再検索を避ける。
                    employeeActorIds = new Set(result.employeeActorIds);
                }
                // ページ単位でUTF-8に符号化し、完了済みページの文字列を保持しない。
                chunks.push(new Blob([formatCsvPage(result.records, employeeActorIds, context.actors)], { type: 'application/octet-stream' }));
                // 今回のページで取得が完了した件数を加算する。
                this.exportedRows += result.records.length;
                // 次回要求に日時とIDの境界を引き継ぐ。
                cursor = pageCursor(result);
                // 全期間CSVではSalesforceが照会に使った上限も引き継ぐ。
                if (result.cutoff) {
                    // 次のページとその再試行に同じ上限を指定する。
                    cursor.cutoff = result.cutoff;
                }
            } while (cursor.nextId);
            // 以前の出力に使ったBlobを解放する。
            this.releaseDownload();
            // 全ページが揃ったCSVにダウンロードURLを発行する。
            this.downloadUrl = URL.createObjectURL(new Blob(chunks, { type: 'application/octet-stream' }));
            // テンプレートのダウンロード用リンクを取得する。
            const link = this.template.querySelector('a[data-download]');
            // 生成したCSVをリンク先に設定する。
            link.href = this.downloadUrl;
            // ページ取得を始めた時点のファイル名で保存する。
            link.download = fileName;
            // 完成したCSVの保存を開始する。
            link.click();
        } catch (error) {
            // 現在の出力のエラーだけを画面に示す。
            if (request === this.exportRequest) {
                // Salesforceの応答に応じて出力失敗を通知する。
                this.exportError = error.body?.message || 'CSVを出力できませんでした。';
            }
        } finally {
            // 現在の出力だけが操作ロックを解除できるようにする。
            if (request === this.exportRequest) {
                // 次のCSV出力を可能にする。
                this.exporting = false;
            }
        }
    }

    // 一覧取得の失敗後に再度読み込む。
    retryRead() {
        // 現在のタブの履歴を再度読み込む。
        return this.read();
    }

    // 現在のタブと検索条件に応じたページを取得する。
    async read() {
        // 一覧と集計のどちらを取得するか決める。
        const chart = this.tab === 'chart';
        // 旧条件の応答を区別する要求番号を発行する。
        const request = ++this.request;
        // 再取得に合わせて以前のエラーを取り下げる。
        this.error = '';
        // 選択タブの結果が取得済みか確認する。
        if (chart ? this.chartReady : this.listReady) {
            // 取得済み明細へ戻った際に前回の件数照会が失敗していれば再試行する。
            if (!chart && this.matchCount === null) {
                this.readMatchCount();
            }
            // キャッシュ利用時は読み込み完了とする。
            this.loading = false;
            // 取得済みの結果をそのまま表示する。
            return;
        }
        // 最新の結果が届くまで読み込み中とする。
        this.loading = true;
        // 一覧だけにページ件数を指定する。
        const query = {
            ...this.searchCriteria, chart,
            ...(!chart ? { pageSize: PAGE_SIZE } : {})
        };
        // 分析は先頭、一覧は移動先の境界から取得する。
        let cursor = chart ? {} : this.pageStarts[this.page - 1];
        const isCurrent = () => request === this.request;
        try {
            if (this.usesMatchIndex && !this.matchingIds) {
                const ids = await this.readMatchingIds(query, isCurrent);
                if (!isCurrent()) {
                    return;
                }
                this.matchingIds = ids;
                this.matchCount = ids.length;
            }
            if (!chart) {
                const offset = (this.page - 1) * PAGE_SIZE;
                const recordIds = this.matchingIds?.slice(offset, offset + PAGE_SIZE);
                const result = recordIds?.length === 0 ? { records: [] } :
                    await load({ criteriaJson: JSON.stringify({ ...query, ...(recordIds ? { recordIds } : cursor) }) });
                if (isCurrent()) {
                    await this.showDetailPage(result, pageCursor(result), isCurrent);
                }
                return;
            }
            // 分析ページごとに通常操作と代理ログインを集約し、補正済みの明細は保持しない。
            const totals = new Map();
            const loginTotals = new Map();
            const delegateNames = {};
            let chartCount = 0;
            let offset = 0;
            do {
                const recordIds = this.matchingIds?.slice(offset, offset + 2000);
                // 次のページには直前の応答の境界を使う。
                // eslint-disable-next-line no-await-in-loop
                const result = recordIds?.length === 0 ? { buckets: [] } : await load({
                    criteriaJson: JSON.stringify({
                        ...query, ...(recordIds ? { recordIds } : cursor),
                        // 月全体の分析から未取得の候補を作る間だけ代理ユーザーの氏名を取得する。
                        includeDelegateNames: !this.hasFilters && !this.filterOptions
                    })
                });
                if (!isCurrent()) {
                    return;
                }
                // 通常操作の合計には各集計行が代表する履歴件数を加える。
                chartCount += mergeChartPage(totals, result.buckets);
                Object.assign(delegateNames, result.delegateNames);
                // 代理ログインは元のページに含まれるうちに補正して集計する。
                if (result.records?.length) {
                    // 照合結果はページ間で共有し、旧条件の結果を混入させない。
                    // eslint-disable-next-line no-await-in-loop
                    const actors = await this.actorsForLogins(result.records);
                    if (!isCurrent()) {
                        return;
                    }
                    chartCount += mergeChartPage(loginTotals, result.records.map(row => loginBucket(row, actors)));
                }
                offset += recordIds?.length ?? 0;
                cursor = recordIds ? { nextId: offset < this.matchingIds.length } : pageCursor(result);
            } while (cursor.nextId);
            // 通常操作を先、代理ログインを後に渡す既存の順序を保持する。
            this.buckets = [...totals.values(), ...loginTotals.values()];
            // 検索中に中断された部分集計を件数として公開しない。
            if (this.hasFilters && !this.usesMatchIndex) {
                this.setResultCount(chartCount);
            }
            // 全件の分析が完了した月だけ、分析結果を候補一覧に再利用する。
            if (!this.hasFilters && !this.filterOptions) {
                // 集計行を一度走査して項目候補とユーザーの両方を取得する。
                const options = collectFilterOptions(this.buckets);
                // ログイン名と表示名で検索できるようにする。
                this.userOptions = options.userOptions;
                // 分析中に候補から外れた選択済みユーザーも識別できるようにする。
                this.userNames = { ...this.userNames, ...options.userOptions, ...options.userNames };
                this.delegateNames = delegateNames;
                // 並行していた候補取得の応答を無効にする。
                this.optionsRequest += 1;
                // 集計結果からの候補作成を完了する。
                this.optionsLoading = false;
                // 分析結果で候補が揃ったため以前の取得エラーを解消する。
                this.optionsError = false;
                // 表示順に並べた候補を検索欄へ渡す。
                this.filterOptions = options.filterOptions;
            }
            // 全ページを取得した分析結果を再利用可能にする。
            this.chartReady = true;
        } catch (error) {
            // 現在の条件での取得失敗だけを表示する。
            if (request === this.request) {
                // 失敗内容を履歴画面で確認できるようにする。
                this.error = error.body?.message || '設定変更履歴を取得できませんでした。';
            }
        } finally {
            // 新しい要求の待機表示を保護する。
            if (request === this.request) {
                // 現在のタブの読み込み完了を表示する。
                this.loading = false;
            }
        }
    }
}
