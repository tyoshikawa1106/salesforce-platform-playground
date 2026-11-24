import { getApexMessage } from 'c/salesforceApiUtils';
import { LightningElement } from 'lwc';
import SetupAuditTrailExportModal from 'c/setupAuditTrailExportModal';
import TIME_ZONE from '@salesforce/i18n/timeZone';
import countMatches from '@salesforce/apex/SetupAuditTrailExplorerController.countMatches';
import loadEmployeeActorIds from '@salesforce/apex/SetupAuditTrailExplorerController.loadEmployeeActorIds';
import startSearch from '@salesforce/apex/SetupAuditTrailExplorerController.startSearch';
import loadFilterOptions from '@salesforce/apex/SetupAuditTrailExplorerController.loadOptionsAt';
import exportAllHistory from '@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory';
import loadLoginAsHistory from '@salesforce/apex/SetupAuditTrailExplorerController.loadLoginAsHistory';
import load from '@salesforce/apex/SetupAuditTrailExplorerController.load';
import {
    CSV_HEADER, PAGE_SIZE, LOOKUP_WINDOW, matchingLookupValues, FILTER_OPTION_FIELDS, buildDateOptions, buildFilterFields, collectFilterOptions, currentMonth,
    appliedFilterLabels, collectLoginAsPairs, hasDelegateAsCreator, historyRow, labelChartActors, needsChartEmployeeLabel, loginAsActors, loginBucket, filterOptionGroups, formatCsvPage, mergeChartPage, needsLoginAsUser, offsetMonth, pageCursor, remainingMatchRecords, sortFilterOptions
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
// 取得済みの明細をスクロールに合わせて表へ追加する単位。
const RENDER_BATCH_SIZE = 50;
// 見出しの件数に桁区切りを付ける。
const COUNT_FORMAT = new Intl.NumberFormat('ja-JP');

// 履歴の検索・分析とCSV出力の操作を受け付ける。
export default class SetupAuditTrailExplorer extends LightningElement {
    // 履歴一覧の列構成を表に渡す。
    columns = COLUMNS;
    // 分析の基準時刻を履歴と同じタイムゾーンで表示する。
    timeZone = TIME_ZONE;
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
    // 直近の5ページは表示用の行を再利用する。ページ境界は別に保持する。
    pageCache = new Map();
    // 同じ時点の履歴、検索候補、分析で基準時刻と代理ログイン照合を共有する。
    historyContext = {};
    // 取得済みの月に戻ったとき、同じ基準時刻の分析を再表示する。
    monthlyAnalyses = new Map();
    // 表示月の完了済み分析と、進行中の要求を区別する。
    analysis;
    analysisContext;
    analysisLoading = false;
    analysisError = '';
    // 一致がちょうど1ページ分の場合は、先に表示して次の一致を探す。
    probeCursor;
    // 同じ履歴検索のページ移動で直近の照合結果を再利用する。
    matchBatch;
    // 取得前と候補なしを区別する。
    filterOptions = null;
    // ログイン名による候補検索を可能にする。
    userOptions = {};
    // ユーザー候補の表示名を保持する。
    userNames = {};
    // 月内の代理ユーザーのログイン名を氏名に対応付ける。
    delegateNames = {};
    // 検索ボタンで確定した条件を履歴一覧に適用する。
    appliedFilters = {};
    // 開いている候補欄を識別する。
    lookupField = '';
    // 候補の絞り込みに使う入力を保持する。
    lookupTerm = '';
    // キーボードでの候補未選択を表す。
    lookupIndex = -1;
    // 一致値は入力と月別候補が変わるまでキーボード操作とスクロールで共有する。
    lookupMatches = [];
    lookupStart = 0;
    lookupRowHeight = 0;
    revealLookupOption = false;
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
    visibleRecords = [];
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
    // 履歴の読み込み表示を管理する。
    loading = false;
    // 履歴取得のエラーを画面に渡す。
    error = '';
    // 履歴の最新の要求を識別する。
    request = 0;
    // 画面離脱時に開いている確認画面と取得中の要求を一緒に終了する。
    exportController;
    // 確認画面を開けない場合や保存を開始できない場合は呼び出し元に表示する。
    downloadError;
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
        // 表示中の条件で履歴を読み込む。
        this.refresh();
    }

    // 離脱前の要求が再表示後の状態に影響しないようにする。
    disconnectedCallback() {
        // 表示を終えた画面のサイズ監視を解除する。
        window.removeEventListener('resize', this.fitHistoryViewport);
        // 離脱前の代理ログイン照合を打ち切る。
        this.historyContext = {};
        // 再接続後に前の月次分析や遅れて届いた応答を反映しない。
        this.analysisContext = undefined;
        this.analysis = undefined;
        this.analysisLoading = false;
        this.analysisError = '';
        this.monthlyAnalyses.clear();
        // 離脱前の履歴応答を無効にする。
        this.request += 1;
        // 離脱前の月別件数を無効にする。
        this.countRequest += 1;
        // 月別件数の再取得を可能にする。
        this.monthTotalLoading = false;
        // 再接続時にフォーカスのない候補欄や古い入力文字を復元しない。
        this.lookupToFocus = null;
        this.closeLookup();
        // 離脱前の候補取得を無効にする。
        this.optionsRequest += 1;
        // 候補の再取得を可能にする。
        this.optionsLoading = false;
        // 離脱前の絞り込み件数を無効にする。
        this.matchRequest += 1;
        // 絞り込み件数の再取得を可能にする。
        this.matchLoading = false;
        // 開いている標準モーダルを閉じ、遅れて完了したCSVを破棄する。
        this.exportController?.abort();
        // 再接続後は新しい出力を開始できるようにする。
        this.exportController = undefined;
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
        if (this.listReady && this.records.length && !this.probeCursor && !this.hasNextPage) {
            // 最終ページの位置から総ページ数を確定する。
            return this.page + ' / ' + this.page + 'ページ';
        }
        // カーソルで到達できる範囲より小さい総ページ数は表示しない。
        const minimumPages = this.page + (this.hasNextPage ? 1 : 0);
        // 件数が未確定または明細と矛盾する間は現在位置のみ表示する。
        return this.totalPages >= minimumPages ? this.page + ' / ' + this.totalPages + 'ページ' : this.page + 'ページ';
    }

    // 表に渡す配列をページ切替時に更新し、件数やCSV進捗だけの変更では再利用する。
    setPageRecords(records) {
        this.records = records;
        this.visibleRecords = records.length > RENDER_BATCH_SIZE ? records.slice(0, RENDER_BATCH_SIZE) : records;
    }

    // 次ページへ進む前に描画できる取得済み明細があるかを判定する。
    get hasMoreRows() {
        return this.visibleRecords.length < this.records.length;
    }

    // 表の末尾では、通信せずに同じページの続きを表示する。
    showMoreRows() {
        // 端数のページでも取得済み件数を上限にする。
        const limit = this.visibleRecords.length + RENDER_BATCH_SIZE;
        this.visibleRecords = limit < this.records.length ? this.records.slice(0, limit) : this.records;
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

    // 先頭の一致行が表示された後も次ページの有無を確認中であることを示す。
    get probingNextPage() {
        return this.listReady && Boolean(this.probeCursor) && !this.error;
    }

    // 前ページへの移動可否を求める。
    get hasPreviousPage() {
        // 先頭より前への移動を防ぐ。
        return this.canOpenPage(this.page - 1);
    }

    // 指定ページを取得できるか調べる。
    canOpenPage(page) {
        // 取得済みのページ境界内に移動先を限定する。
        return page >= 1 && page <= this.pageStarts.length;
    }

    // 読み込み後の空一覧を識別する。
    get emptyList() {
        // 明細取得が完了した場合だけ空表示にする。
        return this.listReady && !this.records.length;
    }

    // 分析完了後の空結果を識別する。
    get chartEmpty() {
        // 集計完了後に結果がない場合だけ空表示にする。
        return this.analysis && !this.analysis.buckets.length;
    }

    // 表示月と月全体の件数を見出しにする。
    get monthHeading() {
        // 月選択値から年と月を取り出す。
        const [year, month] = this.month.split('-');
        // 月を日本語表記に整える。
        const heading = year + '年' + Number(month) + '月';
        // 確定した件数だけを見出しに添える。
        const total = this.tab === 'chart' && this.analysis ? this.analysis.count : this.monthTotal;
        // タブの基準時刻で確定した件数を表示する。
        return total === null ? heading : heading + '（' + COUNT_FORMAT.format(total) + '件）';
    }

    // 完了した分析には独自の総件数があるため、履歴件数の待機や再試行を表示しない。
    get showMonthCountStatus() {
        return this.tab === 'list' || !this.analysis;
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
        // 前の月の未完了応答を破棄し、訪問済みの月は確定済みの分析を使う。
        this.analysisContext = undefined;
        this.analysisLoading = false;
        this.analysisError = '';
        this.analysis = this.monthlyAnalyses.get(month);
        // 編集中の旧条件を取り除く。
        this.resetFilterValues();
        // 検索済み条件を月の切り替えで解除する。
        this.appliedFilters = {};
        // 新しい月には以前の氏名を引き継がない。
        this.userNames = {};
        // 代理ユーザーの表示名も新しい月から取得する。
        this.delegateNames = {};
        // 新しい月の先頭から履歴を表示する。
        this.refresh();
    }

    // 同時に開始する照会を一つの検索時刻に揃え、通信失敗後は再試行を許可する。
    getCutoff(context = this.historyContext) {
        if (!context.cutoffRequest) {
            const pending = startSearch().catch(error => {
                if (context.cutoffRequest === pending) {
                    context.cutoffRequest = undefined;
                }
                throw error;
            });
            context.cutoffRequest = pending;
        }
        return context.cutoffRequest;
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
            const monthStart = this.monthDate;
            const cutoff = await this.getCutoff();
            if (request !== this.countRequest) {
                return;
            }
            const total = await countMatches({ criteriaJson: JSON.stringify({ monthStart, cutoff }) });
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
        const loginUsernames = {};
        const loginDisplayNames = {};
        // 全ページで同じ月を使う。
        const monthStart = this.monthDate;
        // 最初の候補ページから始める。
        let cursor = {};
        try {
            const cutoff = await this.getCutoff();
            if (request !== this.optionsRequest) {
                return;
            }
            // 候補の続きがある間は順番に読み込む。
            do {
                // 次の候補ページには直前のカーソルが必要。
                // eslint-disable-next-line no-await-in-loop
                const result = await this.readPageWithRetry(loadFilterOptions,
                    { criteriaJson: JSON.stringify({ monthStart, cutoff, ...cursor }) }, () => request === this.optionsRequest);
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
                            loginUsernames[actor.CreatedById] = actor.CreatedBy.Username;
                        }
                        if (actor.CreatedById && actor.CreatedBy?.Name) {
                            loginDisplayNames[actor.CreatedById] = actor.CreatedBy.Name;
                        }
                    }
                }
                // 次ページの開始境界を引き継ぐ。
                cursor = pageCursor(result);
            } while (cursor.nextId);
            // 通常履歴と重なるIDには、従来と同じ順で照合済みの候補を適用する。
            this.setUserLookup(Object.assign(users, loginUsernames), Object.assign(names, loginDisplayNames));
            this.delegateNames = delegateNames;
            // 並べ替えた候補をまとめて公開する。
            this.filterOptions = sortFilterOptions(groups);
            this.updateLookupMatches();
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

    // 今月の候補に限って、ログイン名のないユーザーをIDで識別できるようにする。
    setUserLookup(logins, names) {
        const options = { ...logins };
        for (const id of Object.keys(names)) {
            options[id] ??= id;
        }
        this.userOptions = options;
        // 検索済みのユーザーが候補から外れても、選択欄には元の氏名を表示する。
        this.userNames = { ...this.userNames, ...logins, ...names };
    }

    get lookupSources() {
        return { userOptions: this.userOptions, userNames: this.userNames, delegateNames: this.delegateNames, filterOptions: this.filterOptions };
    }

    // 編集中の欄だけを再検索し、変更後の候補は先頭から表示する。
    updateLookupMatches() {
        this.lookupMatches = matchingLookupValues(this.lookupField, this.lookupTerm, this.lookupSources);
        this.lookupIndex = -1;
        this.lookupStart = 0;
        const list = this.template.querySelector('ul[role="listbox"]');
        if (list) {
            list.scrollTop = 0;
        }
    }

    // 選択状態と候補の取得状態を各検索欄に反映する。
    get filterFields() {
        // 入力中の条件を、確定済みの検索条件とは独立して表示する。
        return buildFilterFields({
            sources: this.lookupSources, matches: this.lookupMatches, start: this.lookupStart, rowHeight: this.lookupRowHeight,
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
            // 項目ごとに違う候補行の高さを再計測する。
            this.lookupRowHeight = 0;
            this.updateLookupMatches();
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
        this.updateLookupMatches();
    }

    // 入力中の検索状態を閉じる。
    closeLookup() {
        // 開いている欄の指定を外す。
        this.lookupField = '';
        this.lookupMatches = [];
        this.revealLookupOption = false;
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
            const count = this.lookupMatches.length;
            // 移動可能な候補があるかを確認する。
            if (!count) {
                // 空の一覧で選択位置を作らないようにする。
                return;
            }
            // 押された方向を候補位置の増減に変換する。
            const step = event.key === 'ArrowDown' ? 1 : -1;
            // 未選択時の上移動は末尾から始める。
            const index = this.lookupIndex < 0 && step < 0 ? count - 1 : this.lookupIndex + step;
            // 移動先を候補一覧の範囲に収める。
            this.lookupIndex = Math.max(0, Math.min(index, count - 1));
            // 末尾へ直接移動しても対象の行だけをDOMに用意する。
            if (this.lookupIndex < this.lookupStart || this.lookupIndex >= this.lookupStart + LOOKUP_WINDOW) {
                this.lookupStart = Math.min(Math.max(0, count - LOOKUP_WINDOW), this.lookupIndex);
            }
            this.revealLookupOption = true;
        // 選択位置がある場合だけEnterで確定する。
        } else if (event.key === 'Enter' && this.lookupField && this.lookupIndex >= 0) {
            // 候補確定にEnterを使う。
            event.preventDefault();
            const value = this.lookupMatches[this.lookupIndex];
            if (value !== undefined) {
                this.applyFilter(this.lookupField, value);
            }
        }
    }

    // 可視範囲の少し前から候補を描画し、手動スクロールを選択位置に引き戻さない。
    scrollLookup(event) {
        const list = event.currentTarget;
        const height = this.lookupRowHeight || list.querySelector('[role="option"]')?.getBoundingClientRect().height;
        if (height) {
            this.lookupRowHeight = height;
            this.lookupStart = Math.min(Math.max(0, this.lookupMatches.length - LOOKUP_WINDOW),
                Math.max(0, Math.floor(list.scrollTop / height) - 3));
            if (this.lookupIndex < this.lookupStart || this.lookupIndex >= this.lookupStart + LOOKUP_WINDOW) {
                this.lookupIndex = -1;
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
        if (this.lookupField) {
            // SLDSの実測行高で非表示部分の余白を確保する。
            const height = this.template.querySelector('ul[role="listbox"] [role="option"]')?.getBoundingClientRect().height;
            if (height && height !== this.lookupRowHeight) {
                this.lookupRowHeight = height;
            }
        }
        if (this.revealLookupOption) {
            this.revealLookupOption = false;
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

    // 履歴の条件を確定し、新しい検索時刻で先頭ページを開く。
    search() {
        return this.applySearch();
    }

    // 分析からの移動だけは、選んだ棒と同じ検索時刻で明細を開く。
    applySearch(keepCutoff = false) {
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
        return this.refresh({ keepCutoff, keepMonthData: keepCutoff });
    }

    // タブ切り替えに応じて必要な結果を取得する。
    activateTab(event) {
        // 選択されたタブを識別する。
        const selected = event.target.value;
        // 同じタブの再取得を避ける。
        if (selected && selected !== this.tab) {
            // 選択された表示に切り替える。
            this.tab = selected;
            // 履歴の入力を閉じ、各タブの進行中の要求と取得済み結果を再利用する。
            this.closeLookup();
            if (selected === 'chart') {
                this.readAnalysis();
            } else if (!this.loading && !this.probingNextPage) {
                this.read();
            }
        }
    }

    // 集計行から対応する明細へ移動する。
    selectBucket(event) {
        // 月全体の棒に含まれる履歴だけを、分析と同じ時刻で表示する。
        const { userId, action, day, namespacePrefix, section, delegateUser } = event.detail;
        // 新しい履歴検索を挟んだ場合だけ、候補と件数も分析時点に戻す。
        if (this.historyContext !== this.analysis.context) {
            // 対応する代理ログイン照合と基準時刻を明細要求で共有する。
            this.historyContext = this.analysis.context;
            // 現在の候補は別時点のため、分析済みの候補に置き換える。
            this.filterOptions = null;
            this.useAnalysisForHistory();
        }
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
        this.applySearch(true);
    }

    // 月と絞り込み条件をApexに渡す形式にする。
    get searchCriteria() {
        // 未指定値を補ったうえで確定条件を適用する。
        return { monthStart: this.monthDate, day: null, userId: null, action: null, ...this.appliedFilters };
    }

    // 一覧で確定した絞り込み件数を公開し、以前に開始した件数要求を無効にする。
    setResultCount(count) {
        this.matchRequest += 1;
        this.matchLoading = false;
        this.matchCount = count;
        // 明細で件数が確定したら再試行の案内を閉じる。
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
        // 取得済みの件数が現在の明細と矛盾する場合は再取得する。
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
            const criteria = this.searchCriteria;
            const cutoff = await this.getCutoff();
            if (request !== this.matchRequest) {
                return;
            }
            const count = await countMatches({ criteriaJson: JSON.stringify({ ...criteria, cutoff }) });
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
    refresh({ keepCutoff = false, keepMonthData = false } = {}) {
        if (!keepCutoff) {
            // 初期表示・再検索・月切り替えでは、新しい基準時刻で見出しも更新する。
            this.historyContext = {};
        }
        if (!keepMonthData) {
            this.readMonthTotal();
            // 月全体の候補と代理ログイン照合は同じ基準時刻のドリルダウンで再利用する。
            this.optionsRequest += 1;
            this.filterOptions = null;
            this.userOptions = {};
            this.updateLookupMatches();
            this.optionsError = false;
            this.optionsLoading = false;
            // 自動復旧時に入力中の欄があれば、同じ検索文字で新しい候補の取得を続ける。
            if (this.lookupField) {
                this.readFilterOptions();
            }
        }
        this.pageCache.clear();
        this.probeCursor = null;
        this.matchBatch = undefined;
        // 以前の明細を取得済みと扱わないようにする。
        this.listReady = false;
        // 以前の検索行を取り下げる。
        this.setPageRecords([]);
        // 月変更時に旧月の明細要求とその待機・エラー表示を破棄する。
        this.request += 1;
        this.error = '';
        this.loading = false;
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
        // 表示中のタブだけ読み込みを開始する。
        return this.tab === 'chart' ? this.readAnalysis() : this.read();
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
        this.probeCursor = null;
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
        // 保持期限切れなどで境界が変わったら、その先の明細も再取得する。
        for (const page of this.pageCache.keys()) {
            if (page > this.page) {
                this.pageCache.delete(page);
            }
        }
    }

    // 一時的な通信エラー時は、現在の要求の失敗ページだけを同じ引数で一度再取得する。
    async readPageWithRetry(fetchPage, query, isCurrent) {
        try {
            // 指定された境界から履歴を取得する。
            return await fetchPage(query);
        } catch (error) {
            // 離脱後の要求と一時的通信エラー以外を再試行から除く。
            if (!isCurrent() || ![0, 502, 503, 504].includes(error?.status)) {
                // 元のエラーを呼び出し元へ伝える。
                throw error;
            }
            // 同じ取得条件を使って失敗したページだけを再試行する。
            return fetchPage(query);
        }
    }

    // 代理ログインを初めて含む明細ページでだけ照合を開始する。
    async readCsvPage(fetchPage, query, isCurrent, context) {
        // 月別・全期間の既存のページ境界と再試行を共通で使う。
        const page = await this.readPageWithRetry(fetchPage, query, isCurrent);
        // 離脱後や照合済みの出力では追加の要求を送らない。
        if (isCurrent() && !context.actors && page.records.some(needsLoginAsUser)) {
            // 出力ごとに独立した照合結果を全明細ページで共有する。
            // 月外のログアウトも含め、明細の出力開始時刻までを照合する。
            context.actors = await this.readActors(page.cutoff, isCurrent);
        }
        // 明細の追加前に呼び出し元で要求の有効性を再確認する。
        return page;
    }

    // 分析・候補用の代理ログインには本文がないため、作成者だけで照合要否を判定する。
    actorsForLogins(logins, context = this.historyContext) {
        // 作成者が判明している行だけなら照合ページを取得しない。
        return context.actors ?? (logins.some(hasDelegateAsCreator) ? this.readScreenActors(context) : undefined);
    }

    // 同じ基準時刻に属する一覧・分析・候補の照合を一度だけ開始する。
    readScreenActors(context = this.historyContext) {
        if (!context.pendingActors) {
            // 履歴再検索中も、分析が同じ時点を参照している間は照合を継続する。
            const isCurrent = () => context === this.historyContext || context === this.analysisContext;
            context.pendingActors = this.getCutoff(context).then(cutoff => this.readActors(cutoff, isCurrent)).then(actors => {
                // 取得済みの対応表を同じ時点の各利用元へ渡す。
                context.actors = actors;
                return actors;
            }).finally(() => {
                // 失敗した照合は同じ検索でも再試行できる。
                context.pendingActors = undefined;
            });
        }
        return context.pendingActors;
    }

    // 保持期間全体でログインとログアウトを照合し、完了した結果だけを返す。
    async readActors(cutoff, isCurrent) {
        const pairs = new Map();
        let query = { cutoff: cutoff ?? null };
        do {
            // 次ページは直前の応答で確定した上限と境界で取得する。
            // eslint-disable-next-line no-await-in-loop
            const page = await this.readPageWithRetry(loadLoginAsHistory, query, isCurrent);
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

    // 日時とIDの境界を前の応答から引き継ぎ、照会したページを一つずつ渡す。
    async *sourcePages(query, cursor, isCurrent) {
        do {
            // 次のページは直前の応答の境界に依存する。
            // eslint-disable-next-line no-await-in-loop
            const page = await this.readPageWithRetry(load, { criteriaJson: JSON.stringify({ ...query, ...cursor }) }, isCurrent);
            if (!isCurrent()) {
                return;
            }
            yield page;
            cursor = pageCursor(page);
        } while (cursor.nextId && isCurrent());
    }

    // 一致しない元ページも読み進め、履歴の続きには直近の照合結果を使う。
    async *matchingBatches(query, start, isCurrent) {
        const cached = this.matchBatch;
        const remaining = remainingMatchRecords(cached, start);
        if (remaining) {
            yield { records: remaining, cursor: cached.cursor };
            start = cached.cursor;
            if (!start.nextId || !isCurrent()) {
                return;
            }
        }
        for await (const page of this.sourcePages({ ...query, matchIndex: true }, start, isCurrent)) {
            // 代理ログインを含むユーザー検索にだけ、共通の作成者照合を適用する。
            if (query.userId && !this.historyContext.actors && page.records.some(row => row.Action === 'suOrgAdminLogin')) {
                await this.readScreenActors();
                if (!isCurrent()) {
                    return;
                }
            }
            // 元ページの末尾を境界にし、一致しなかった範囲をもう一度走査しない。
            const records = query.userId ? page.records.filter(row =>
                (this.historyContext.actors?.get(row.Id)?.CreatedById ?? row.CreatedById) === query.userId) : page.records;
            if (!isCurrent()) {
                return;
            }
            const cursor = pageCursor(page);
            this.matchBatch = { start, records, cursor };
            yield { records, cursor };
            start = cursor;
        }
    }

    // 一致する行がページを満たした時点で明細を表示し、件数の全走査を待たない。
    async readIndexedPage(query, start, isCurrent) {
        const ids = [];
        for await (const { records, cursor } of this.matchingBatches(query, start, isCurrent)) {
            if (!isCurrent()) {
                return;
            }
            // 取得済みの一致行を残して、表示に足りない件数だけ取り込む。
            const needed = PAGE_SIZE - ids.length;
            ids.push(...records.slice(0, needed).map(row => row.Id));
            if (ids.length < PAGE_SIZE && cursor.nextId) {
                continue;
            }
            // 同じ元ページに次の一致がある場合は、採用した最終行の直後から再開する。
            const last = records[needed - 1];
            const next = records.length > needed ? { nextId: last.Id, nextTime: last.CreatedDate } : {};
            const details = ids.length ? await this.readPageWithRetry(load,
                { criteriaJson: JSON.stringify({ ...query, recordIds: ids }) }, isCurrent) : { records: [] };
            if (!isCurrent()) {
                return;
            }
            // ちょうど満杯で続きが未確認のときだけ、元ページ境界を保存する。
            this.probeCursor = !next.nextId && ids.length === PAGE_SIZE && cursor.nextId ? cursor : null;
            await this.showDetailPage(details, next, isCurrent);
            if (!isCurrent()) {
                return;
            }
            if (this.probeCursor) {
                // 次の一致を確認する間も、取得済みの明細は操作できる。
                this.loading = false;
                await this.probeNextPage(query, isCurrent);
            } else if (!next.nextId) {
                this.setResultCount(this.rowNumberOffset + details.records.length);
            }
            return;
        }
    }

    // 残りに最初の一致が見つかった場合だけ「次へ」を公開する。
    async probeNextPage(query, isCurrent) {
        let start = this.probeCursor;
        for await (const { records, cursor } of this.matchingBatches(query, start, isCurrent)) {
            if (!isCurrent()) {
                return;
            }
            if (records.length || !cursor.nextId) {
                this.probeCursor = null;
                this.rememberNextPage(records.length ? start : {});
                if (!records.length) {
                    this.setResultCount(this.rowNumberOffset + this.records.length);
                }
                this.cachePage();
                return;
            }
            // タブ移動や通信失敗の後は確認済みの空ページを飛ばす。
            start = cursor;
            this.probeCursor = cursor;
        }
    }

    // 大きい明細配列だけを直近5ページに制限し、古いページは保存した境界で開く。
    cachePage() {
        // 挿入順を利用して、戻って表示したページも最新の利用位置へ移す。
        this.pageCache.delete(this.page);
        this.pageCache.set(this.page, this.records);
        if (this.pageCache.size > 5) {
            this.pageCache.delete(this.pageCache.keys().next().value);
        }
    }

    // 照合した利用者と代理ユーザーの氏名を履歴一覧に表示する。
    async showDetailPage(result, cursor, isCurrent) {
        // 保持期限などで移動先が空になった場合は、有効な境界を先頭から取り直す。
        if (this.page > 1 && !result.records.length) {
            // 検索時刻を保ち、期限切れの行を含む件数・候補・ページ境界を取り直す。
            await this.refresh({ keepCutoff: true });
            // 空になったページの応答を新しい一覧へ反映しない。
            return;
        }
        if (!this.historyContext.actors && result.records.some(needsLoginAsUser)) {
            await this.readScreenActors();
            if (!isCurrent()) {
                return;
            }
        }
        const employees = new Set(result.employeeActorIds);
        // ページを開くたびに表示範囲を先頭へ戻す。
        this.setPageRecords(result.records.map(row => historyRow(row, employees, this.historyContext.actors, result.delegateNames, result.localizedActions)));
        this.rememberNextPage(cursor);
        if (!this.probeCursor) {
            this.cachePage();
        }
        this.listReady = true;
        // 明細の境界が確定してから不足する件数だけを取得する。
        this.readMatchCount();
    }

    get resultExportDisabled() {
        return this.loading || !this.listReady || !this.records.length;
    }

    // 絞り込みは確認画面を開いた時点の条件と基準時刻で固定する。
    openResultExport() {
        // 条件の表示名は検索欄の編集途中の値から独立させる。
        const labels = appliedFilterLabels(this.appliedFilters, this.lookupSources).join(' ／ ') || '絞り込みなし';
        // 検索結果だけ件数の確定を待ってから出力を許可する。
        this.openExportDialog('results', labels);
    }

    // 表示ページとは独立して一致ID、件数、基準時刻を確定する。
    async prepareResultExport(isCurrent) {
        // 件数取得の途中で条件を読み直さないようにする。
        const query = this.searchCriteria;
        // 明細と同じ照合方式を使って出力対象を決める。
        const indexed = this.usesMatchIndex;
        // 確定済みの件数は問い合わせを増やさず再利用する。
        let count = this.resultCount;
        // 履歴と同じ基準時刻をすべてのページに引き継ぐ。
        query.cutoff = await this.getCutoff();
        // 確認画面を閉じた後に追加の件数照会を送らない。
        if (!isCurrent()) return undefined;
        // 照合が必要な検索は一致IDを確認と出力で共用する。
        if (indexed) {
            // ページをまたぐ一致IDを順番に保持する。
            const ids = [];
            // 一覧の照合と同じ判定を使う。
            for await (const batch of this.matchingBatches(query, {}, isCurrent)) {
                // 明細の代わりに一致IDだけを保持する。
                ids.push(...batch.records.map(row => row.Id));
            }
            // 件数と出力対象を同じ集合から返す。
            return { query, ids, count: ids.length };
        }
        // 一覧で件数を確定していない場合だけ問い合わせる。
        if (count === null) {
            // 出力時に使う条件と基準時刻を渡す。
            count = await this.readPageWithRetry(countMatches, { criteriaJson: JSON.stringify(query) }, isCurrent);
        }
        // 直接検索の明細は固定した条件を使って全ページ取得する。
        return { query, count };
    }

    // ツールバーの主ボタンは選択月を出力対象にする。
    openMonthlyExport() {
        // 一覧の絞り込み条件から独立した月別出力を確認する。
        this.openExportDialog('month');
    }

    // メニューで全期間を選んだ場合も同じ確認画面を使う。
    selectExportOption(event) {
        // 全期間を選んだ場合だけ対応する取得方法を使う。
        if (event.detail.value === 'all') {
            // 保持期間全体を確認画面に明示する。
            this.openExportDialog('all');
        }
    }

    // 標準モーダルが出力完了で閉じた場合だけダウンロードを開始する。
    async openExportDialog(period, filters) {
        // 一つの操作で複数の確認画面を開かない。
        if (this.exportController) return;
        // 再接続や別の出力と進行中の操作を区別する。
        const controller = new AbortController();
        // 呼び出し元の離脱時に確認画面へ中断を伝える。
        this.exportController = controller;
        // 再試行前に前回の開始エラーを取り下げる。
        this.downloadError = undefined;
        // 表示と取得で同じ月を使う。
        const month = this.month;
        // 完成したファイルはモーダルの終了理由を確認するまで保存しない。
        let file;
        // 標準の閉じる操作・Esc・キャンセルはいずれも保存を開始しない。
        try {
            // 検索結果の確定とページ取得を、各モーダルの有効期間に限定する。
            const completed = await SetupAuditTrailExportModal.open({
                size: 'small', label: 'CSV出力', period, month, filters, ownerSignal: controller.signal,
                prepareSelection: isCurrent => this.prepareResultExport(isCurrent),
                buildFile: async (selection, isCurrent, progress) => {
                    // 取得結果をモーダル間で共有しない。
                    file = await this.buildCsv(period, month, selection, isCurrent, progress);
                }
            });
            // 中断または画面離脱後に完成したファイルを保存しない。
            if (completed && file && !controller.signal.aborted) {
                // ダウンロードURLは呼び出し元で次の出力または離脱まで管理する。
                this.downloadCsv(file);
            }
        } catch (error) {
            // 現在の画面に属する開始・保存エラーだけを表示する。
            if (!controller.signal.aborted) this.downloadError = getApexMessage(error, 'CSV出力を開始できませんでした。');
        } finally {
            // 前のモーダルの終了で再接続後の操作を解除しない。
            if (this.exportController === controller) {
                // 次の出力を受け付ける。
                this.exportController = undefined;
                // メニュー項目から開いた場合も、元の起点にキーボード操作を戻す。
                const launcher = { all: 'lightning-button-menu', month: '[data-monthly-export]', results: '[data-result-export]' }[period];
                // 起点が現在も表示されている場合だけフォーカスを戻す。
                this.template.querySelector(launcher)?.focus();
            }
        }
    }

    // IDを指定する出力では照合順に分割し、各組の中でもCSVの文字数境界に従って取得する。
    async *csvPages(fetchPage, query, isCurrent, context, ids) {
        const groups = ids ? Math.ceil(ids.length / PAGE_SIZE) : 1;
        for (let group = 0; group < groups; group++) {
            const criteria = ids ? { ...query, recordIds: ids.slice(group * PAGE_SIZE, (group + 1) * PAGE_SIZE) } : query;
            let cursor = {};
            do {
                if (!isCurrent()) {
                    return;
                }
                // eslint-disable-next-line no-await-in-loop
                const result = await this.readCsvPage(fetchPage, { ...criteria, ...cursor }, isCurrent, context);
                if (!isCurrent()) {
                    return;
                }
                yield result;
                cursor = pageCursor(result);
                if (result.cutoff) {
                    cursor.cutoff = result.cutoff;
                }
            } while (cursor.nextId);
        }
    }

    // 全ページと確認時の件数が揃ったCSVだけを保存可能にする。
    async buildCsv(period, month, selection, isCurrent, progress) {
        // ファイル名は確認操作を行った時刻を基準にする。
        const prefix = { month: 'SetupAuditTrailMonthly', all: 'SetupAuditTrailAll', results: 'SetupAuditTrailFiltered' }[period];
        // 取得にかかった時間でファイル名を変更しない。
        const fileName = prefix + Date.now() + '.csv';
        // 全期間だけ専用のApexメソッドから取得する。
        const fetchPage = period === 'all' ? exportAllHistory : query => load({ criteriaJson: JSON.stringify(query) });
        // 月別と検索結果では確認時の条件を復元する。
        const query = period === 'all' ? { cutoff: null } : { monthStart: month + '-01', ...selection?.query, csv: true };
        // UTF-8のBOMと列名をファイルの先頭に置く。
        const chunks = ['\uFEFF', CSV_HEADER];
        // 作成者の照合結果を出力単位で共有する。
        let employeeActorIds = new Set();
        // 検索結果の出力では一覧で取得済みの照合結果を利用する。
        const context = { actors: selection && this.historyContext.actors };
        // 再試行の進捗はゼロから数える。
        let rows = 0;
        // 返された境界を使って全ページを順に取得する。
        for await (const result of this.csvPages(fetchPage, query, isCurrent, context, selection?.ids)) {
            // 先頭ページの根拠を後続ページでも引き継ぐ。
            if (result.employeeActorIds) {
                // 作成者IDの照合で履歴ごとの再検索を避ける。
                employeeActorIds = new Set(result.employeeActorIds);
            }
            // ページ単位でUTF-8に符号化し、完了済みページの文字列を保持しない。
            chunks.push(new Blob([formatCsvPage(result.records, employeeActorIds, context.actors, result.localizedActions)], { type: 'application/octet-stream' }));
            // 完了済みの明細だけを進捗に含める。
            rows += result.records.length;
            // 確認画面で取得済み件数を更新する。
            progress(rows);
        }
        // 中断したときは部分的なファイルを作らない。
        if (!isCurrent()) return undefined;
        // 確認時の一致件数と出力件数が違う場合は保存前に知らせる。
        if (selection && rows !== selection.count) {
            // 検索条件を再確認できる文面をモーダル内に表示する。
            throw new Error('確認時と出力時の件数が異なります。履歴を再検索してください。');
        }
        // 中断されずに確認画面が閉じるまでBlobのまま保持する。
        return { blob: new Blob(chunks, { type: 'application/octet-stream' }), fileName };
    }

    // 全ページが揃い、確認画面が出力完了で閉じた場合だけ保存する。
    downloadCsv({ blob, fileName }) {
        // 以前の出力に使ったBlobを解放する。
        this.releaseDownload();
        // 次の出力または画面離脱までURLを保持する。
        this.downloadUrl = URL.createObjectURL(blob);
        // 自分のテンプレート内のリンクから保存する。
        const link = this.template.querySelector('a[data-download]');
        // 生成したCSVをリンク先に設定する。
        link.href = this.downloadUrl;
        // ページ取得を始めた時点のファイル名で保存する。
        link.download = fileName;
        // 完成したCSVの保存を開始する。
        link.click();
    }

    // 一覧取得の失敗後に再度読み込む。
    retryRead() {
        // 現在のタブの履歴を再度読み込む。
        return this.read();
    }

    // 履歴の現在ページを取得する。分析の取得とは独立して完了できる。
    async read() {
        // 旧条件の応答を区別する要求番号を発行する。
        const request = ++this.request;
        // 再取得に合わせて以前のエラーを取り下げる。
        this.error = '';
        // 選択タブの結果が取得済みか確認する。
        if (this.pageCache.has(this.page) && !this.listReady) {
            this.setPageRecords(this.pageCache.get(this.page));
            this.listReady = true;
            this.cachePage();
        }
        if (this.listReady && !this.probeCursor) {
            // 取得済み明細へ戻った際に前回の件数照会が失敗していれば再試行する。
            if (this.matchCount === null) {
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
            ...this.searchCriteria, chart: false, pageSize: PAGE_SIZE
        };
        // 移動先の履歴ページの境界から取得する。
        const cursor = this.pageStarts[this.page - 1];
        const isCurrent = () => request === this.request;
        try {
            query.cutoff = await this.getCutoff();
            if (!isCurrent()) {
                return;
            }
            if (this.listReady && this.probeCursor) {
                this.loading = false;
                await this.probeNextPage(query, isCurrent);
            } else if (this.usesMatchIndex) {
                await this.readIndexedPage(query, cursor, isCurrent);
            } else {
                const result = await this.readPageWithRetry(load, { criteriaJson: JSON.stringify({ ...query, ...cursor }) }, isCurrent);
                if (isCurrent()) {
                    await this.showDetailPage(result, pageCursor(result), isCurrent);
                }
            }
        } catch (error) {
            // 現在の条件での取得失敗だけを表示する。
            if (request === this.request) {
                // 失敗内容を履歴画面で確認できるようにする。
                this.error = getApexMessage(error, '設定変更履歴を取得できませんでした。');
            }
        } finally {
            // 新しい要求の待機表示を保護する。
            if (request === this.request) {
                // 現在のタブの読み込み完了を表示する。
                this.loading = false;
            }
        }
    }

    // 選択月を条件に一度だけ走査し、同じ月の履歴検索中も取得を継続する。
    async readAnalysis() {
        if (this.analysis || this.analysisLoading) {
            return;
        }
        // 月変更と離脱で古い要求の結果を破棄する。
        const month = this.month;
        const context = this.historyContext;
        this.analysisContext = context;
        const isCurrent = () => this.analysisContext === context && this.month === month;
        this.analysisLoading = true;
        this.analysisError = '';
        try {
            // 履歴側の絞り込みを含めず、月全体に共通の取得時刻を固定する。
            const cutoff = await this.getCutoff(context);
            if (!isCurrent()) {
                return;
            }
            // 後からこの時点の検索候補を復元できるよう代理ユーザー名も保存する。
            const includeDelegateNames = context !== this.historyContext || !this.filterOptions;
            const delegateNames = includeDelegateNames ? {} : { ...this.delegateNames };
            const query = { monthStart: month + '-01', chart: true, cutoff, includeDelegateNames };
            // 通常履歴と代理ログインをそれぞれページ間で合算する。
            const totals = new Map();
            const loginTotals = new Map();
            let count = 0;
            for await (const result of this.sourcePages(query, {}, isCurrent)) {
                count += mergeChartPage(totals, result.buckets);
                Object.assign(delegateNames, result.delegateNames);
                if (result.records?.length) {
                    // 分析開始時点で照合したユーザーを使う。
                    const actors = await this.actorsForLogins(result.records, context);
                    if (!isCurrent()) {
                        return;
                    }
                    count += mergeChartPage(loginTotals, result.records.map(row => loginBucket(row, actors)));
                }
            }
            if (!isCurrent()) {
                return;
            }
            // 全ページが揃った分析だけをタブ切替と月の再訪で使う。
            const buckets = [...totals.values(), ...loginTotals.values()];
            const employeeActorIds = buckets.some(needsChartEmployeeLabel)
                ? await this.readPageWithRetry(loadEmployeeActorIds, { cutoff }, isCurrent) : [];
            if (!isCurrent()) {
                return;
            }
            labelChartActors(buckets, employeeActorIds);
            this.analysis = { context, cutoff, count, delegateNames, buckets };
            this.monthlyAnalyses.set(month, this.analysis);
            if (context === this.historyContext) {
                // 同じ基準時刻を参照中の履歴だけに月全体の結果を引き継ぐ。
                this.useAnalysisForHistory();
            }
        } catch (error) {
            if (isCurrent()) {
                // 取得失敗は分析タブだけに表示し、部分集計は公開しない。
                this.analysisError = getApexMessage(error, '月全体の分析を取得できませんでした。');
            }
        } finally {
            if (isCurrent()) {
                this.analysisLoading = false;
            }
        }
    }

    // 履歴と同じ基準時刻の分析から、月の総件数と未取得の検索候補を補う。
    useAnalysisForHistory() {
        // 先に開始した月別件数の応答による上書きを防ぐ。
        this.countRequest += 1;
        this.monthTotal = this.analysis.count;
        this.monthTotalLoading = false;
        this.monthTotalError = false;
        // 候補が揃っている場合は集計行を再走査しない。
        if (this.filterOptions) {
            return;
        }
        // 日付・ユーザー・操作などの集計行から一意な候補を抽出する。
        const options = collectFilterOptions(this.analysis.buckets);
        this.setUserLookup(options.userOptions, options.userNames);
        this.delegateNames = this.analysis.delegateNames;
        // 並行していた候補要求を無効にし、完成した結果を表示する。
        this.optionsRequest += 1;
        this.optionsLoading = false;
        this.optionsError = false;
        this.filterOptions = options.filterOptions;
        this.updateLookupMatches();
    }
}
