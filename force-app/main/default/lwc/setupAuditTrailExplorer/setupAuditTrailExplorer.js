import { LightningElement } from 'lwc';
import TIME_ZONE from '@salesforce/i18n/timeZone';
import countMatches from '@salesforce/apex/SetupAuditTrailExplorerController.countMatches';
import countMonth from '@salesforce/apex/SetupAuditTrailExplorerController.countMonth';
import loadFilterOptions from '@salesforce/apex/SetupAuditTrailExplorerController.loadDistinctFilterOptions';
import exportAllHistory from '@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory';
import load from '@salesforce/apex/SetupAuditTrailExplorerController.load';

const COLUMNS = [
    { label: '日付', fieldName: 'CreatedDate', type: 'date', initialWidth: 185, typeAttributes: {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: TIME_ZONE
    }},
    { label: 'ユーザー', fieldName: 'userFullName', initialWidth: 300, wrapText: true },
    { label: '名前空間プレフィックス', fieldName: 'ResponsibleNamespacePrefix', initialWidth: 165, wrapText: true },
    { label: 'アクション', fieldName: 'Display', wrapText: true },
    { label: 'セクション', fieldName: 'Section', initialWidth: 240, wrapText: true },
    { label: '代理ユーザー', fieldName: 'DelegateUser', initialWidth: 175, wrapText: true }
].map(column => ({
    ...column,
    hideDefaultActions: true,
    cellAttributes: { class: 'slds-text-body_small' }
}));
const CSV_HEADER = '日付,ユーザー,ソースの名前空間プレフィックス,アクション,セクション,代理ユーザー\n';

function currentMonth() {
    const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: TIME_ZONE })
        .formatToParts(new Date());
    return parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value;
}

function offsetMonth(month, offset) {
    const date = new Date(month + '-01T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
}

const PAGE_SIZE = 200;
const COUNT_FORMAT = new Intl.NumberFormat('ja-JP');
const CSV_DATE_FORMAT = new Intl.DateTimeFormat('ja-JP', {
    calendar: 'gregory', timeZone: TIME_ZONE, timeZoneName: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function pageCursor({ nextId, nextTime }) {
    return { nextId, nextTime };
}

const FILTER_OPTION_FIELDS = ['action', 'namespacePrefix', 'delegateUser'];

function filterOptionGroups() {
    return Object.fromEntries(FILTER_OPTION_FIELDS.map(field => [field, new Set()]));
}

function collectFilterOptions(groups, buckets) {
    for (const bucket of buckets) {
        for (const field of FILTER_OPTION_FIELDS) {
            if (bucket[field]) {
                groups[field].add(bucket[field]);
            }
        }
    }
}

function sortFilterOptions(groups) {
    return Object.fromEntries(FILTER_OPTION_FIELDS.map(field => [
        field, [...groups[field]].sort((left, right) => left.localeCompare(right, 'ja'))
    ]));
}

function csvCell(value) {
    return '"' + String(value ?? '').replaceAll('"', '""') + '"';
}

function formatCsvPage(records) {
    let lastDate;
    let formattedDate;
    return records.map(row => {
        if (row.CreatedDate !== lastDate) {
            lastDate = row.CreatedDate;
            formattedDate = CSV_DATE_FORMAT.format(new Date(lastDate));
        }
        return [formattedDate, row.CreatedBy?.Username, row.ResponsibleNamespacePrefix,
            row.Display, row.Section, row.DelegateUser].map(csvCell).join(',') + '\n';
    }).join('');
}

export default class SetupAuditTrailExplorer extends LightningElement {
    columns = COLUMNS;
    month = currentMonth();
    userId = null;
    action = null;
    namespacePrefix = null;
    delegateUser = null;
    filterOptions = null;
    userOptions = {};
    userNames = {};
    appliedFilters = {};
    lookupField = '';
    lookupTerm = '';
    lookupIndex = -1;
    optionsRequest = 0;
    optionsError = false;
    optionsLoading = false;
    day = null;
    tab = 'list';
    records = [];
    buckets = [];
    pageStarts = [{}];
    matchCount = null;
    matchRequest = 0;
    matchLoading = false;
    page = 1;
    listReady = false;
    chartReady = false;
    loading = false;
    error = '';
    request = 0;
    exportRequest = 0;
    exporting = false;
    exportError = '';
    exportedRows = 0;
    downloadUrl;
    monthTotal = null;
    monthTotalLoading = false;
    monthTotalError = false;
    countRequest = 0;

    connectedCallback() {
        window.addEventListener('resize', this.fitHistoryViewport);
        this.readMonthTotal();
        this.refresh();
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this.fitHistoryViewport);
        this.request += 1;
        this.countRequest += 1;
        this.monthTotalLoading = false;
        this.optionsRequest += 1;
        this.optionsLoading = false;
        this.matchRequest += 1;
        this.matchLoading = false;
        this.exportRequest += 1;
        this.exporting = false;
        this.releaseDownload();
    }

    releaseDownload() {
        if (this.downloadUrl) {
            URL.revokeObjectURL(this.downloadUrl);
            this.downloadUrl = undefined;
        }
    }

    get monthDate() {
        return this.month + '-01';
    }

    get exportProgress() {
        return 'CSVを作成中（' + this.exportedRows + '件取得済み）';
    }

    get hasFilters() {
        return Object.values(this.appliedFilters).some(Boolean);
    }

    get resultCount() {
        return this.hasFilters ? this.matchCount : this.monthTotal;
    }

    get totalPages() {
        return this.resultCount === null ? null : Math.ceil(this.resultCount / PAGE_SIZE);
    }

    get pageSummary() {
        if (this.emptyList && this.page === 1) {
            return '0 / 0ページ';
        }
        return this.totalPages ? this.page + ' / ' + this.totalPages + 'ページ' : this.page + 'ページ';
    }

    get rowNumberOffset() {
        return (this.page - 1) * PAGE_SIZE;
    }

    get hasNextPage() {
        return this.canOpenPage(this.page + 1);
    }

    get hasPreviousPage() {
        return this.canOpenPage(this.page - 1);
    }

    canOpenPage(page) {
        return page >= 1 && page <= this.pageStarts.length;
    }

    get emptyList() {
        return this.listReady && !this.records.length;
    }

    get chartEmpty() {
        return this.chartReady && !this.buckets.length;
    }

    get monthHeading() {
        const [year, month] = this.month.split('-');
        const heading = year + '年' + Number(month) + '月';
        return this.monthTotal === null ? heading : heading + '（' + COUNT_FORMAT.format(this.monthTotal) + '件）';
    }

    get previousMonthDisabled() {
        return this.month <= offsetMonth(currentMonth(), -6);
    }

    get nextMonthDisabled() {
        return this.month >= currentMonth();
    }

    moveMonth(event) {
        const offset = Number(event.currentTarget.dataset.step);
        if ((offset === -1 && !this.previousMonthDisabled) || (offset === 1 && !this.nextMonthDisabled)) {
            this.setMonth(offsetMonth(this.month, offset));
        }
    }

    setMonth(month) {
        if (month === this.month) {
            return;
        }
        this.month = month;
        this.resetFilterValues();
        this.appliedFilters = {};
        this.readMonthTotal();
        this.optionsRequest += 1;
        this.filterOptions = null;
        this.userOptions = {};
        this.userNames = {};
        this.optionsError = false;
        this.optionsLoading = false;
        this.refresh();
    }

    async readMonthTotal() {
        const request = ++this.countRequest;
        this.monthTotalLoading = true;
        this.monthTotal = null;
        this.monthTotalError = false;
        try {
            const total = await countMonth({ monthStart: this.monthDate });
            if (request === this.countRequest) {
                this.monthTotal = total;
            }
        } catch {
            if (request === this.countRequest) {
                this.monthTotalError = true;
            }
        } finally {
            if (request === this.countRequest) {
                this.monthTotalLoading = false;
            }
        }
    }

    // 対象月に記録された候補だけを取得し、月切り替え前の応答は破棄する。
    async readFilterOptions() {
        if (this.optionsLoading || this.filterOptions) {
            return;
        }
        const request = ++this.optionsRequest;
        this.optionsError = false;
        this.optionsLoading = true;
        const groups = filterOptionGroups();
        const users = {};
        const names = {};
        const monthStart = this.monthDate;
        let cursor = {};
        try {
            do {
                // 次の候補ページには直前のカーソルが必要。
                // eslint-disable-next-line no-await-in-loop
                const result = await loadFilterOptions({ monthStart, ...cursor });
                if (request !== this.optionsRequest) {
                    return;
                }
                for (const field of FILTER_OPTION_FIELDS) {
                    for (const value of result.options[field]) {
                        groups[field].add(value);
                    }
                }
                Object.assign(users, result.userOptions);
                Object.assign(names, result.userNames);
                cursor = pageCursor(result);
            } while (cursor.nextId);
            this.userOptions = users;
            this.userNames = names;
            this.filterOptions = sortFilterOptions(groups);
        } catch {
            if (request === this.optionsRequest) {
                this.optionsError = true;
            }
        } finally {
            if (request === this.optionsRequest) {
                this.optionsLoading = false;
            }
        }
    }

    get selectedDay() {
        return this.day || '';
    }

    get dateOptions() {
        const firstDay = new Date(this.monthDate + 'T00:00:00Z');
        const days = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
        const dates = Array.from({ length: days }, (_, index) =>
            this.monthDate.slice(0, 8) + String(days - index).padStart(2, '0')
        );
        return [{ label: 'すべて', value: '' }, ...dates.map(value => ({ label: value, value }))];
    }

    get filterFields() {
        return [
            { key: 'userId', label: 'ユーザー', values: Object.keys(this.userOptions) },
            { key: 'namespacePrefix', label: '名前空間プレフィックス', values: this.filterOptions?.namespacePrefix },
            { key: 'action', label: 'アクション', values: this.filterOptions?.action },
            { key: 'delegateUser', label: '代理ユーザー', values: this.filterOptions?.delegateUser }
        ].map(({ key, label, values }) => {
            const labelFor = value => {
                if (key === 'userId') {
                    return this.userNames[value] || this.userOptions[value] || value;
                }
                return value;
            };
            const selected = this[key];
            if (this.lookupField !== key) {
                return {
                    key, label, open: false, selected: Boolean(selected),
                    inputValue: selected ? labelFor(selected) : '',
                    clearLabel: label + 'の選択を解除',
                    selectedIcon: key === 'userId' ? 'standard:user' : 'standard:custom'
                };
            }

            const term = this.lookupTerm.trim().toLocaleLowerCase();
            const candidates = values ?? [];
            const matches = term
                ? candidates.filter(value => labelFor(value).toLocaleLowerCase().includes(term) ||
                    (key === 'userId' && (value.toLocaleLowerCase().includes(term) ||
                        this.userOptions[value]?.toLocaleLowerCase().includes(term))))
                : candidates;
            const options = matches;
            const listId = key + '-options';
            return {
                key, label, open: true, listId,
                inputValue: this.lookupTerm,
                activeId: this.lookupIndex >= 0 ? listId + '-' + this.lookupIndex : undefined,
                noMatches: Boolean(this.filterOptions) && matches.length === 0,
                options: options.map((value, index) => ({
                    label: labelFor(value),
                    code: key === 'userId' ? value : '',
                    value,
                    id: listId + '-' + index,
                    active: index === this.lookupIndex,
                    className: 'slds-listbox__option slds-listbox__option_entity slds-media slds-media_small' +
                        (index === this.lookupIndex ? ' slds-has-focus' : '')
                }))
            };
        });
    }

    openLookup(event) {
        const field = event.currentTarget.dataset.field;
        if (field !== this.lookupField) {
            this.lookupField = field;
            this.lookupTerm = '';
            this.lookupIndex = -1;
        }
        if (!this.optionsError) {
            this.readFilterOptions();
        }
    }

    searchFilterOptions(event) {
        this.openLookup(event);
        this.lookupTerm = event.target.value;
        this.lookupIndex = -1;
    }

    closeLookup() {
        this.lookupField = '';
        this.lookupTerm = '';
        this.lookupIndex = -1;
    }

    keepLookupFocus(event) {
        event.preventDefault();
    }

    handleLookupKey(event) {
        if (event.isComposing) {
            return;
        }
        if (event.key === 'Escape' && this.lookupField) {
            event.preventDefault();
            this.closeLookup();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            this.openLookup(event);
            const field = this.filterFields.find(item => item.key === this.lookupField);
            if (!field.options.length) {
                return;
            }
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const index = this.lookupIndex < 0 && step < 0 ? field.options.length - 1 : this.lookupIndex + step;
            this.lookupIndex = Math.max(0, Math.min(index, field.options.length - 1));
        } else if (event.key === 'Enter' && this.lookupField && this.lookupIndex >= 0) {
            event.preventDefault();
            const field = this.filterFields.find(item => item.key === this.lookupField);
            const option = field.options[this.lookupIndex];
            if (option) {
                this.applyFilter(field.key, option.value);
            }
        }
    }

    renderedCallback() {
        this.fitHistoryViewport();
        if (this.lookupIndex >= 0) {
            this.template.querySelector('.slds-has-focus[role="option"]')?.scrollIntoView?.({ block: 'nearest' });
        }
    }

    // フィルターの折り返しやウィンドウの高さに合わせて本文の表示域を調整する。
    fitHistoryViewport = () => {
        const viewport = this.template.querySelector('.c-history-viewport');
        if (viewport) {
            const top = Math.round(Math.max(0, viewport.getBoundingClientRect().top));
            viewport.style.setProperty('--c-history-top', top + 'px');
        }
    };

    selectLookupOption(event) {
        this.applyFilter(this.lookupField, event.currentTarget.dataset.value);
    }

    // 選択を解除したあとも検索を押すまで確定済みの条件を保持する。
    clearLookupSelection(event) {
        this.applyFilter(event.currentTarget.dataset.field, null);
    }

    handleSelectedLookupKey(event) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            this.clearLookupSelection(event);
        }
    }

    changeFilter(event) {
        this.applyFilter(event.currentTarget.dataset.field, event.detail.value);
    }

    applyFilter(field, selected) {
        this.closeLookup();
        this[field] = selected || null;
    }

    resetFilterValues() {
        this.closeLookup();
        this.userId = null;
        this.namespacePrefix = null;
        this.action = null;
        this.delegateUser = null;
        this.day = null;
    }

    // 編集中の条件を確定し、履歴と分析が同じ条件を使うようにする。
    search() {
        this.closeLookup();
        this.appliedFilters = {
            day: this.day,
            userId: this.userId,
            action: this.action,
            ...(this.namespacePrefix ? { namespacePrefix: this.namespacePrefix } : {}),
            ...(this.delegateUser ? { delegateUser: this.delegateUser } : {})
        };
        return this.refresh();
    }

    activateTab(event) {
        const selected = event.target.value;
        if (selected && selected !== this.tab) {
            this.tab = selected;
            this.readMatchCount();
            this.read();
        }
    }

    selectBucket(event) {
        const { userId, action, day, namespacePrefix, delegateUser } = { ...this.appliedFilters, ...event.detail };
        this.userId = userId ?? null;
        this.action = action ?? null;
        this.day = day ?? null;
        this.namespacePrefix = namespacePrefix ?? null;
        this.delegateUser = delegateUser ?? null;
        this.tab = 'list';
        this.search();
    }

    get searchCriteria() {
        return { monthStart: this.monthDate, day: null, userId: null, action: null, ...this.appliedFilters };
    }

    async readMatchCount() {
        // 絞り込み件数は履歴のページ送りでだけ使う。
        if (this.tab !== 'list' || !this.hasFilters || this.matchCount !== null || this.matchLoading) {
            return;
        }
        const request = ++this.matchRequest;
        this.matchLoading = true;
        try {
            const count = await countMatches({ criteriaJson: JSON.stringify(this.searchCriteria) });
            if (request === this.matchRequest) {
                this.matchCount = count;
            }
        } catch {
            // Keep cursor navigation available when only the total cannot be retrieved.
        } finally {
            if (request === this.matchRequest) {
                this.matchLoading = false;
            }
        }
    }

    refresh() {
        this.listReady = false;
        this.chartReady = false;
        this.records = [];
        this.buckets = [];
        this.pageStarts = [{}];
        this.matchRequest += 1;
        this.matchLoading = false;
        this.matchCount = null;
        this.page = 1;
        this.readMatchCount();
        return this.read();
    }

    nextPage() {
        this.goToPage(this.page + 1);
    }

    previousPage() {
        this.goToPage(this.page - 1);
    }

    goToPage(page) {
        if (this.loading || page === this.page || !this.canOpenPage(page)) {
            return;
        }
        this.page = page;
        this.listReady = false;
        this.read();
    }

    rememberNextPage(cursor) {
        const previous = this.pageStarts[this.page];
        if (previous?.nextId === cursor.nextId && previous?.nextTime === cursor.nextTime) {
            return;
        }
        const starts = this.pageStarts.slice(0, this.page);
        if (cursor.nextId) {
            starts.push(cursor);
        }
        this.pageStarts = starts;
    }

    async readExportPage(fetchPage, query, request) {
        try {
            return await fetchPage(query);
        } catch (error) {
            if (request !== this.exportRequest || ![0, 502, 503, 504].includes(error?.status)) {
                throw error;
            }
            return fetchPage(query);
        }
    }

    exportMonth() {
        return this.exportCsv(this.month, query => load({ criteriaJson: JSON.stringify(query) }), { monthStart: this.monthDate, csv: true });
    }

    selectExportOption(event) {
        if (event.detail.value === 'all') {
            return this.exportCsv('all', exportAllHistory, { cutoff: new Date().toISOString() });
        }
        return undefined;
    }

    async exportCsv(period, fetchPage, query) {
        if (this.exporting) {
            return;
        }
        const request = ++this.exportRequest;
        const chunks = ['\uFEFF', CSV_HEADER];
        let cursor = {};
        this.exporting = true;
        this.exportError = '';
        this.exportedRows = 0;
        try {
            do {
                // Each page supplies the cursor for the next request.
                // eslint-disable-next-line no-await-in-loop
                const result = await this.readExportPage(fetchPage, { ...query, ...cursor }, request);
                if (request !== this.exportRequest) {
                    return;
                }
                chunks.push(formatCsvPage(result.records));
                this.exportedRows += result.records.length;
                cursor = pageCursor(result);
            } while (cursor.nextId);
            this.releaseDownload();
            this.downloadUrl = URL.createObjectURL(new Blob(chunks, { type: 'application/octet-stream' }));
            const link = this.template.querySelector('a[data-download]');
            link.href = this.downloadUrl;
            link.download = 'setup-audit-trail-' + period + '.csv';
            link.click();
        } catch (error) {
            if (request === this.exportRequest) {
                this.exportError = error.body?.message || 'CSVを出力できませんでした。';
            }
        } finally {
            if (request === this.exportRequest) {
                this.exporting = false;
            }
        }
    }

    retryRead() {
        this.readMatchCount();
        return this.read();
    }

    async read() {
        const chart = this.tab === 'chart';
        const request = ++this.request;
        this.error = '';
        if (chart ? this.chartReady : this.listReady) {
            this.loading = false;
            return;
        }
        this.loading = true;
        const query = {
            ...this.searchCriteria, chart,
            ...(!chart ? { pageSize: PAGE_SIZE } : {})
        };
        let cursor = chart ? {} : this.pageStarts[this.page - 1];
        const totals = new Map();
        try {
            do {
                // Each page supplies the cursor for the next request.
                // eslint-disable-next-line no-await-in-loop
                const result = await load({ criteriaJson: JSON.stringify({ ...query, ...cursor }) });
                if (request !== this.request) {
                    return;
                }
                cursor = pageCursor(result);
                if (!chart) {
                    this.records = result.records.map(row => ({ ...row, userFullName: row.CreatedBy?.Name }));
                    this.rememberNextPage(cursor);
                    this.listReady = true;
                    return;
                }
                for (const bucket of result.buckets) {
                    const key = JSON.stringify([
                        bucket.day, bucket.userId, bucket.action, bucket.section, bucket.namespacePrefix, bucket.delegateUser
                    ]);
                    const previous = totals.get(key);
                    if (previous) {
                        previous.count += bucket.count;
                    } else {
                        totals.set(key, { ...bucket });
                    }
                }
            } while (cursor.nextId);
            this.buckets = [...totals.values()];
            // 全件の分析が完了した月だけ、分析結果を候補一覧に再利用する。
            if (!this.hasFilters && !this.filterOptions) {
                const groups = filterOptionGroups();
                collectFilterOptions(groups, this.buckets);
                this.userOptions = Object.fromEntries(this.buckets
                    .filter(bucket => bucket.userId && bucket.loginName)
                    .map(bucket => [bucket.userId, bucket.loginName]));
                this.userNames = Object.fromEntries(this.buckets
                    .filter(bucket => bucket.userId && bucket.userName)
                    .map(bucket => [bucket.userId, bucket.userName]));
                this.optionsRequest += 1;
                this.optionsLoading = false;
                this.optionsError = false;
                this.filterOptions = sortFilterOptions(groups);
            }
            this.chartReady = true;
        } catch (error) {
            if (request === this.request) {
                this.error = error.body?.message || '設定変更履歴を取得できませんでした。';
            }
        } finally {
            if (request === this.request) {
                this.loading = false;
            }
        }
    }
}