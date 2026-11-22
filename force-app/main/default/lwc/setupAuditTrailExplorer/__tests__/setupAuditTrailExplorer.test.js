import { createElement } from 'lwc';
import Explorer from 'c/setupAuditTrailExplorer';
import * as historyLogic from '../setupAuditTrailExplorerLogic';
import countMatches from '@salesforce/apex/SetupAuditTrailExplorerController.countMatches';
import startSearch from '@salesforce/apex/SetupAuditTrailExplorerController.startSearch';
import loadFilterOptions from '@salesforce/apex/SetupAuditTrailExplorerController.loadOptionsAt';
import exportAllHistory from '@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory';
import loadLoginAsHistory from '@salesforce/apex/SetupAuditTrailExplorerController.loadLoginAsHistory';
import load from '@salesforce/apex/SetupAuditTrailExplorerController.load';

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.load', () => {
    const request = jest.fn();
    return { default: Object.assign(({
        criteriaJson
    }) => request({ input: JSON.parse(criteriaJson) }), { request }) };
}, { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.startSearch', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.countMatches', () => {
    const request = jest.fn();
    const month = jest.fn();
    return { default: Object.assign(({ criteriaJson }) => {
        const input = JSON.parse(criteriaJson);
        return Object.hasOwn(input, 'day') ? request({ input }) : month(input);
    }, { request, month }) };
}, { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.loadOptionsAt', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.loadLoginAsHistory', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/i18n/lang', () => ({ default: 'ja' }), { virtual: true });

const countMonth = countMatches.month;
const cutoff = '2026-11-19T10:00:00.000Z';

beforeEach(() => {
    startSearch.mockReset().mockResolvedValue(cutoff);
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    loadFilterOptions.mockResolvedValue({ options: { action: ['createdApexClass'], namespacePrefix: [], delegateUser: [] } });
    countMonth.mockResolvedValue(0);
    countMatches.request.mockResolvedValue(0);
});

jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Asia/Tokyo' }), { virtual: true });


const flush = () => new Promise(resolve => require('timers').setImmediate(resolve));

function confirmCsv(component) {
    const dialog = component.shadowRoot.querySelector('dialog[open]');
    expect(dialog).not.toBeNull();
    [...dialog.querySelectorAll('lightning-button')].find(button => button.label === '出力').click();
}

function mount() {
    const component = createElement('c-setup-audit-trail-explorer', { is: Explorer });
    document.body.appendChild(component);
    return component;
}

async function chooseLookup(component, field, value) {
    const root = component.shadowRoot;
    const clear = root.querySelector(`lightning-button-icon[data-field="${field}"]`);
    if (clear) {
        clear.click();
        await flush();
    }
    if (!value) {
        return;
    }
    const input = root.querySelector(`input[data-field="${field}"]`);
    input.click();
    await flush();
    component.shadowRoot.querySelector(`[role="option"][data-value="${value}"]`).click();
    await flush();
}

async function search(component) {
    [...component.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === '検索').click();
    await flush();
}

afterEach(() => {
    document.body.replaceChildren();
    loadFilterOptions.mockReset();
    exportAllHistory.mockReset();
    loadLoginAsHistory.mockReset();
    load.request.mockReset();
    countMonth.mockReset();
    countMatches.request.mockReset();
    jest.restoreAllMocks();
});

it('merges chart buckets across pages and reuses them as filter options', async () => {
    const bucket = { day: '2026-11-18', userId: '005000000000001', action: 'createdApexClass' };
    const namespacedBucket = { ...bucket, namespacePrefix: 'sample' };
    const delegatedBucket = { ...bucket, delegateUser: 'Delegate@example.invalid' };
    load.request.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ buckets: [{ ...bucket, count: 2 }, { ...delegatedBucket, count: 4 }],
            delegateNames: { 'delegate@example.invalid': '代理 担当' }, nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ buckets: [{ ...bucket, count: 3 }, { ...namespacedBucket, count: 1 }] });
    const component = mount();
    await flush();
    const [, chartTab] = component.shadowRoot.querySelectorAll('lightning-tab');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ chart: true, includeDelegateNames: true, nextId: 'cursor', nextTime: 'time' }) });
    expect(component.shadowRoot.querySelector('c-setup-audit-trail-chart').buckets).toEqual([
        { ...bucket, count: 5 },
        { ...delegatedBucket, count: 4 },
        { ...namespacedBucket, count: 1 }
    ]);
    await chooseLookup(component, 'namespacePrefix', 'sample');
    await chooseLookup(component, 'delegateUser', delegatedBucket.delegateUser);
    expect(component.shadowRoot.querySelector('input[data-field="delegateUser"]').value).toBe('代理 担当');
    expect(loadFilterOptions).not.toHaveBeenCalled();
});

it('uses the recorded user for lookup and chart when the delegate is a different user', async () => {
    const login = { Id: 'login', Action: 'suOrgAdminLogin', CreatedDate: '2026-11-02T03:00:00Z',
        CreatedById: 'target', CreatedBy: { Name: '対象', Username: 'target@example.invalid' }, DelegateUser: 'admin@example.invalid' };
    load.request.mockResolvedValueOnce({ records: [] }).mockResolvedValueOnce({ buckets: [], records: [login] });
    loadFilterOptions.mockResolvedValueOnce({ options: {}, records: [login], nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ options: {}, userOptions: { target: 'target@example.invalid' }, userNames: { target: '別表記' } });
    const root = mount().shadowRoot;
    await flush();
    root.querySelector('input[data-field="userId"]').click();
    await flush();
    const monthStart = load.request.mock.calls[0][0].input.monthStart;
    expect(loadFilterOptions.mock.calls.map(([request]) => JSON.parse(request.criteriaJson))).toEqual([
        { monthStart, cutoff }, { monthStart, cutoff, nextId: 'cursor', nextTime: 'time' }
    ]);
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(root.querySelector('[role="option"]').textContent).toContain('対象');
    root.querySelectorAll('lightning-tab')[1].dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request.mock.lastCall[0].input.includeDelegateNames).toBe(false);
    expect(root.querySelector('c-setup-audit-trail-chart').buckets[0]).toMatchObject({ userId: 'target', count: 1 });
    expect(loadLoginAsHistory).not.toHaveBeenCalled();
});

it('loads candidates on demand and applies selected filters only on search', async () => {
    load.request.mockResolvedValue({ records: [] });
    loadFilterOptions.mockResolvedValueOnce({
        options: { action: [], namespacePrefix: ['first'], delegateUser: [] }, nextId: 'cursor', nextTime: 'time'
    }).mockResolvedValue({
        options: { action: [], namespacePrefix: ['first', 'second'], delegateUser: ['Delegate@example.invalid', 'former@example.invalid'] },
        delegateNames: { 'delegate@example.invalid': '代理 担当' }
    });
    const component = mount();
    await flush();
    expect(loadFilterOptions).not.toHaveBeenCalled();
    const namespace = component.shadowRoot.querySelector('input[data-field="namespacePrefix"]');
    namespace.click();
    await flush();
    expect([...component.shadowRoot.querySelectorAll('[role="option"]')].map(option => option.dataset.value))
        .toEqual(['first', 'second']);
    namespace.value = 'sec';
    namespace.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect([...component.shadowRoot.querySelectorAll('[role="option"]')].map(option => option.dataset.value))
        .toEqual(['second']);
    namespace.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    await flush();
    namespace.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await flush();
    expect(load.request).toHaveBeenCalledTimes(1);
    expect(countMatches.request).not.toHaveBeenCalled();
    await chooseLookup(component, 'delegateUser', 'Delegate@example.invalid');
    await search(component);
    expect(load.request).toHaveBeenCalledTimes(2);
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ namespacePrefix: 'second', delegateUser: 'Delegate@example.invalid' }) });
    await chooseLookup(component, 'namespacePrefix', '');
    await search(component);
    expect(component.shadowRoot.querySelector('input[data-field="namespacePrefix"]').value).toBe('');
    expect(component.shadowRoot.querySelector('input[data-field="delegateUser"]').value).toBe('代理 担当');
    component.shadowRoot.querySelector('input[data-field="namespacePrefix"]').click();
    await flush();
    expect([...component.shadowRoot.querySelectorAll('[role="option"]')].map(option => option.dataset.value))
        .toEqual(['first', 'second']);
    expect(load.request.mock.lastCall[0].input).not.toHaveProperty('namespacePrefix');
    await chooseLookup(component, 'delegateUser', 'former@example.invalid');
    expect(component.shadowRoot.querySelector('input[data-field="delegateUser"]').value).toBe('former@example.invalid');
});

it('finds a delegate by name or login and selects the login shown on the second line', async () => {
    const login = 'delegate@example.invalid';
    const other = 'other@example.invalid';
    load.request.mockResolvedValue({ records: [] });
    loadFilterOptions.mockResolvedValue({ options: { delegateUser: [login, other] },
        delegateNames: { [login]: '代理 担当', [other]: '代理 担当' } });
    const component = mount();
    const root = component.shadowRoot;
    await flush();
    const input = root.querySelector('input[data-field="delegateUser"]');
    input.click();
    await flush();
    input.value = '担当';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect([...root.querySelectorAll('[role="option"]')].map(option =>
        [...option.firstElementChild.children].map(line => line.textContent))).toEqual([
        ['代理 担当', login], ['代理 担当', other]
    ]);
    input.value = 'OTHER@';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    const options = root.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    options[0].click();
    await flush();
    expect(input.value).toBe('代理 担当');
    await search(component);
    expect(load.request.mock.lastCall[0].input.delegateUser).toBe(other);
});

it('shows raw action codes and month users', async () => {
    const userId = '005000000000001';
    load.request.mockResolvedValue({ records: [] });
    loadFilterOptions.mockResolvedValue({
        options: { action: ['filteredLookupActivate'], namespacePrefix: [], delegateUser: [] },
        userOptions: { '005000000000002': 'other@example.invalid', [userId]: 'audit@example.invalid' },
        userNames: { '005000000000002': '山田 太郎', [userId]: '山田 太郎' }
    });
    const component = mount();
    await flush();
    const userInput = component.shadowRoot.querySelector('input[data-field="userId"]');
    userInput.click();
    await flush();
    const userOption = component.shadowRoot.querySelector(`[role="option"][data-value="${userId}"]`);
    expect(userOption.firstElementChild.children[0].textContent).toBe('山田 太郎');
    expect(userOption.firstElementChild.children[1].textContent).toBe('audit@example.invalid');
    userOption.click();
    await flush();
    expect(component.shadowRoot.querySelector('input[data-field="userId"]').value).toBe('山田 太郎');
    expect(component.shadowRoot.textContent).not.toContain(userId);
    const action = component.shadowRoot.querySelector('input[data-field="action"]');
    action.click();
    await flush();
    action.value = 'lookupactivate';
    action.dispatchEvent(new CustomEvent('input'));
    await flush();
    const option = component.shadowRoot.querySelector('[role="option"][data-value="filteredLookupActivate"]');
    expect(option.textContent).toContain('filteredLookupActivate');
    option.click();
    await flush();
    const selectedAction = component.shadowRoot.querySelector('input[data-field="action"]');
    expect(selectedAction.value).toBe('filteredLookupActivate');
    const box = selectedAction.closest('section.slds-box');
    expect(box.querySelectorAll('.slds-combobox_container.slds-has-selection input[readonly]')).toHaveLength(2);
    expect(box.querySelector('lightning-button-icon[data-field="action"]').alternativeText).toBe('アクションの選択を解除');
    expect([...box.querySelectorAll('lightning-button')].some(button => button.label === '検索')).toBe(true);
    await search(component);
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ userId, action: 'filteredLookupActivate' }) });

    component.shadowRoot.querySelector('input[data-field="delegateUser"]').click();
    await flush();
    expect(component.shadowRoot.textContent).toContain('候補がありません。');
    expect(component.shadowRoot.querySelector('[role="option"]')).toBeNull();
});

it('retries the same list page after a request fails', async () => {
    load.request.mockRejectedValueOnce({ body: { message: '取得エラー' } }).mockResolvedValueOnce({ records: [] });
    const component = mount();
    await flush();
    const retry = [...component.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === '再試行');
    retry.click();
    await flush();
    expect(load.request).toHaveBeenCalledTimes(2);
    expect(load.request.mock.calls[0]).toEqual(load.request.mock.calls[1]);
    expect(component.shadowRoot.textContent).toContain('条件に一致する設定変更履歴はありません。');
});

it.each(['month', 'all'])('downloads %s history with UTF-8 text and standard date and newline formatting', async period => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const download = jest.spyOn(HTMLAnchorElement.prototype, 'click');
    const downloaded = new Promise(resolve => download.mockImplementation(() => resolve()));
    const row = {
        CreatedDate: '2026-11-18T00:00:00.000Z',
        CreatedBy: { Username: 'audit@example.invalid' },
        ResponsibleNamespacePrefix: 'sample',
        Display: '=原文,"引用"\r\n続き🧪',
        Section: 'Apps',
        DelegateUser: 'delegate@example.invalid'
    };
    URL.createObjectURL = jest.fn(() => 'blob:audit');
    URL.revokeObjectURL = jest.fn();
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    try {
        await flush();
        await chooseLookup(component, 'action', 'createdApexClass');
        await search(component);
        const exportPage = period === 'month' ? load.request : exportAllHistory;
        const serverCutoff = '2026-11-19T13:43:07.912Z';
        const login = { ...row, Id: 'login', Action: 'suOrgAdminLogin', CreatedById: 'admin', CreatedBy: { Username: row.DelegateUser },
            Display: '対象 のログインアクセスを使用してログイン済み' };
        const logout = { ...row, Id: 'logout', Action: 'suOrgAdminLogout', CreatedById: 'target', CreatedDate: '2026-11-18T00:05:00Z',
            CreatedBy: { Name: '対象', Username: 'target@example.invalid' }, Display: '対象 のログインアクセスを使用してログアウト済み' };
        loadLoginAsHistory.mockResolvedValueOnce({ records: [logout], cutoff: serverCutoff, nextId: 'logout', nextTime: logout.CreatedDate })
            .mockResolvedValueOnce({ records: [login], cutoff: serverCutoff });
        exportPage.mockResolvedValueOnce({ records: [row], nextId: 'cursor', nextTime: 'time',
            cutoff: serverCutoff, employeeActorIds: ['employee'] })
            .mockResolvedValueOnce({ records: [{ ...row, CreatedById: 'employee', CreatedBy: null }, login], cutoff: serverCutoff });
        const monthStart = load.request.mock.calls[0][0].input.monthStart;
        const menu = component.shadowRoot.querySelector('lightning-button-menu');
        const launcher = period === 'all' ? menu : component.shadowRoot.querySelector('[data-monthly-export]');
        const focusLauncher = jest.spyOn(launcher, 'focus');
        expect(menu.querySelector('lightning-menu-item').label).toBe('CSV出力 (全期間)');
        const startedAt = Date.UTC(2026, 10, 19, 13, 38, 7, 912);
        const clock = jest.spyOn(Date, 'now').mockReturnValue(startedAt);
        if (period === 'month') {
            [...component.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === 'CSV出力').click();
        } else {
            menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'all' } }));
        }
        await flush();
        expect(component.shadowRoot.querySelector('dialog[open]').textContent).toContain(period === 'all' ? '全期間' : monthStart.slice(0, 7));
        expect(exportAllHistory).not.toHaveBeenCalled();
        expect(load.request.mock.calls.some(([{ input }]) => input.csv)).toBe(false);
        confirmCsv(component);
        clock.mockReturnValue(startedAt + 5000);
        await downloaded;

        const queries = period === 'month'
            ? load.request.mock.calls.slice(2).map(([request]) => request.input)
            : exportAllHistory.mock.calls.map(([request]) => request);
        const monthQuery = { monthStart, csv: true };
        expect(queries).toEqual([
            period === 'month' ? monthQuery : { cutoff: null },
            { ...(period === 'month' ? monthQuery : {}), cutoff: serverCutoff, nextId: 'cursor', nextTime: 'time' }
        ]);
        expect(download).toHaveBeenCalledTimes(1);
        expect(focusLauncher).toHaveBeenCalled();
        expect(component.shadowRoot.querySelector('lightning-spinner')).toBeNull();
        const [blob] = URL.createObjectURL.mock.calls[0];
        const csv = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(blob, 'utf-8');
        });
        const header = '日付,ユーザー,ソースの名前空間プレフィックス,アクション,セクション,代理ユーザー\n';
        const line = '"2026/11/18 9:00:00 JST","audit@example.invalid","sample","=原文,""引用""\n続き🧪","Apps","delegate@example.invalid"\n';
        expect(loadLoginAsHistory.mock.calls.map(([query]) => query)).toEqual([
            { cutoff: serverCutoff },
            { cutoff: serverCutoff, nextId: 'logout', nextTime: logout.CreatedDate }
        ]);
        expect(csv).toBe(header + line + line.replace('audit@example.invalid', '株式会社セールスフォース・ジャパン') +
            '"2026/11/18 9:00:00 JST","target@example.invalid","sample","' + login.Display + '","Apps","delegate@example.invalid"\n');
        expect(component.shadowRoot.querySelector('a[data-download]').download)
            .toBe((period === 'month' ? 'SetupAuditTrailMonthly' : 'SetupAuditTrailAll') + startedAt + '.csv');
        component.remove();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audit');
    } finally {
        component.remove();
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    }
});

it('retries only the failed CSV page after a temporary connection error', async () => {
    const page = { records: [{ CreatedDate: '2026-11-18T00:00:00Z' }], nextId: 'cursor', nextTime: 'time' };
    load.request.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce(page)
        .mockRejectedValueOnce({ status: 503 })
        .mockImplementationOnce(() => new Promise(() => {}));
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(button => button.label === 'CSV出力').click();
    confirmCsv(component);
    await flush();

    expect(load.request).toHaveBeenCalledTimes(4);
    expect(load.request.mock.calls[2]).toEqual(load.request.mock.calls[3]);
    expect(load.request.mock.calls[3][0].input).toEqual(expect.objectContaining({ nextId: 'cursor', nextTime: 'time' }));
    expect(component.shadowRoot.querySelector('[role="status"]').textContent)
        .toBe('CSVを作成中（1件取得済み）');
    expect(component.shadowRoot.querySelector('lightning-spinner').alternativeText).toBe('CSVを作成中');
});

it('shows a CSV permission error without retrying', async () => {
    load.request.mockResolvedValueOnce({ records: [] })
        .mockRejectedValueOnce({ status: 403, body: { message: 'アクセス権限がありません。' } });
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(button => button.label === 'CSV出力').click();
    confirmCsv(component);
    await flush();

    expect(load.request).toHaveBeenCalledTimes(2);
    expect(component.shadowRoot.querySelector('[role="alert"]').textContent)
        .toContain('アクセス権限がありません。');
    expect(component.shadowRoot.querySelector('lightning-spinner')).toBeNull();
});

it('stops fetching CSV pages when the component is removed', async () => {
    let finishPage;
    load.request.mockResolvedValueOnce({ records: [] }).mockImplementationOnce(() => new Promise(resolve => {
        finishPage = resolve;
    }));
    const component = mount();
    await flush();
    const button = [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(child => child.label === 'CSV出力');
    button.click();
    confirmCsv(component);
    component.remove();
    finishPage({ records: [], nextId: 'cursor', nextTime: 'time' });
    await flush();
    expect(load.request).toHaveBeenCalledTimes(2);
});

it('reports how many CSV rows have been fetched while waiting for the next page', async () => {
    const row = { CreatedDate: '2026-11-18T00:00:00Z' };
    load.request.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [row], nextId: 'cursor', nextTime: 'time' })
        .mockImplementationOnce(() => new Promise(() => {}));
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(child => child.label === 'CSV出力').click();
    confirmCsv(component);
    await flush();
    expect(component.shadowRoot.querySelector('[role="status"]').textContent)
        .toBe('CSVを作成中（1件取得済み）');
    expect(loadLoginAsHistory).not.toHaveBeenCalled();
});

it('stops fetching login-as evidence after leaving the page', async () => {
    let finishEvidence;
    load.request.mockResolvedValueOnce({ records: [] }).mockResolvedValueOnce({ records: [{
        Action: 'suOrgAdminLogin', Display: '対象 のログインアクセスを使用してログイン済み',
        CreatedBy: { Username: 'admin' }, DelegateUser: 'admin'
    }] });
    loadLoginAsHistory.mockImplementationOnce(() => new Promise(resolve => { finishEvidence = resolve; }));
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === 'CSV出力').click();
    confirmCsv(component);
    await flush();
    component.remove();
    finishEvidence({ records: [], nextId: 'more', nextTime: 'time' });
    await flush();
    expect(loadLoginAsHistory).toHaveBeenCalledTimes(1);
    expect(load.request).toHaveBeenCalledTimes(2);
});

it('keeps the current result when the normalized action filter is unchanged', async () => {
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    await flush();
    await chooseLookup(component, 'action', 'createdApexClass');
    await chooseLookup(component, 'action', 'createdApexClass');
    expect(load.request).toHaveBeenCalledTimes(1);
});


it('shows the monthly count and keeps it when a list filter changes', async () => {
    countMonth.mockResolvedValue(21638);
    countMatches.request.mockResolvedValue(1001);
    load.request.mockResolvedValue({ records: [{ Id: 'first' }], nextId: 'cursor', nextTime: 'time' });
    const component = mount();
    await flush();
    expect(component.shadowRoot.textContent).toContain('月（21,638件）');
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    expect(countMonth).toHaveBeenCalledTimes(2);
    expect(countMatches.request).toHaveBeenCalledTimes(1);
    expect(component.shadowRoot.textContent).toContain('1 / 2ページ');
    expect(component.shadowRoot.textContent).toContain('月（21,638件）');
});

it('moves through adjacent pages and resets the cursor only after search', async () => {
    countMonth.mockResolvedValue(2002);
    load.request.mockImplementation(({ input: { nextId, action } }) => {
        if (action) {
            return Promise.resolve({ records: [] });
        }
        const row = { Id: nextId || 'first-page-row' };
        const next = { undefined: 'cursor-2', 'cursor-2': 'cursor-3' }[nextId];
        return Promise.resolve({ records: [row], nextId: next, nextTime: next ? 'time' : undefined });
    });
    const component = mount();
    const root = component.shadowRoot;
    const button = label => [...root.querySelectorAll('nav lightning-button')].find(item => item.label === label);
    await flush();
    expect([...root.querySelectorAll('nav lightning-button')].map(item => item.label)).toEqual(['次へ']);
    expect(load.request.mock.calls[0][0].input).toMatchObject({ pageSize: 1000, chart: false });
    button('次へ').click();
    await flush();
    expect(root.textContent).toContain('2 / 3ページ');
    expect(root.querySelector('lightning-datatable').rowNumberOffset).toBe(1000);
    button('次へ').click();
    await flush();
    expect(root.textContent).toContain('3 / 3ページ');
    expect(button('次へ')).toBeUndefined();
    const reads = load.request.mock.calls.length;
    button('前へ').click();
    await flush();
    expect(load.request).toHaveBeenCalledTimes(reads);
    expect(root.querySelector('lightning-datatable').data[0].Id).toBe('cursor-2');

    await chooseLookup(component, 'action', 'createdApexClass');
    expect(root.textContent).toContain('2 / 3ページ');
    await search(component);
    expect(load.request.mock.calls.at(-1)[0].input).not.toHaveProperty('nextId');
    expect(root.textContent).toContain('0 / 0ページ');
});

it.each([1, 1000])('shows 1 / 1 without adjacent pages for a monthly total of %i', async total => {
    countMonth.mockResolvedValue(total);
    load.request.mockResolvedValue({ records: [{ Id: 'row' }] });
    const component = mount();
    await flush();
    const pagination = component.shadowRoot.querySelector('nav');
    expect(pagination.textContent).toContain('1 / 1ページ');
    expect(pagination.querySelector('lightning-button')).toBeNull();
});

it('counts all chart pages including delegated logins and reuses the monthly result on revisit', async () => {
    const login = { Action: 'suOrgAdminLogin', CreatedDate: cutoff, CreatedById: 'target' };
    load.request.mockImplementation(({ input }) => {
        if (!input.chart) {
            return { records: [{ Id: 'first' }], nextId: 'detail', nextTime: 'time' };
        }
        return input.nextId ? { buckets: [{ action: 'change', count: 500 }], records: [login] } :
            { buckets: [{ action: 'change', count: 500 }], nextId: 'more', nextTime: 'time' };
    });
    const root = mount().shadowRoot;
    await flush();
    const [history, chart] = root.querySelectorAll('lightning-tab');
    expect(history.querySelector('section[aria-label="検索条件"]')).toBeTruthy();
    expect(chart.querySelector('[data-field]')).toBeNull();
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(root.querySelector('h2[aria-live]').textContent).toContain('1,001件');
    expect(chart.querySelector('lightning-formatted-date-time').value).toBe(cutoff);
    history.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(history.textContent).toContain('1 / 2ページ');
    root.querySelector('[data-step="-1"]').click();
    await flush();
    root.querySelector('[data-step="1"]').click();
    await flush();
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request.mock.calls.filter(([{ input }]) => input.chart)).toHaveLength(2);
    expect(chart.querySelector('c-setup-audit-trail-chart').buckets).toHaveLength(2);
    await expect(root.host).toBeAccessible();
});

it.each([true, false])('ignores an old monthly analysis after switching months (failure: %s)', async fails => {
    let settle;
    load.request.mockResolvedValueOnce({ records: [] })
        .mockImplementationOnce(() => new Promise((resolve, reject) => {
            settle = () => (fails ? reject(new Error('old month')) : resolve({ buckets: [{ action: 'old', count: 10 }] }));
        }))
        .mockResolvedValueOnce({ buckets: [{ action: 'current', count: 2 }] });
    const root = mount().shadowRoot;
    await flush();
    const chart = root.querySelectorAll('lightning-tab')[1];
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    root.querySelector('[data-step="-1"]').click();
    await flush();
    settle();
    await flush();
    expect(chart.querySelector('c-setup-audit-trail-chart').buckets).toEqual([{ action: 'current', count: 2 }]);
    expect(chart.querySelector('[role="alert"]')).toBeNull();
});

it('keeps a pending filtered count independent of the monthly analysis', async () => {
    let finishCount;
    countMatches.request.mockImplementation(() => new Promise(resolve => { finishCount = resolve; }));
    load.request.mockImplementation(({ input }) => (input.chart ? { buckets: [{ action: 'change', count: 2001 }] } :
        { records: [{ Id: 'first' }], nextId: 'detail', nextTime: 'time' }));
    const component = mount();
    await flush();
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    const [history, chart] = component.shadowRoot.querySelectorAll('lightning-tab');
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request.mock.lastCall[0].input.action).toBeUndefined();
    finishCount(1001);
    await flush();
    history.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(history.textContent).toContain('1 / 2ページ');
    expect(history.querySelector('input[data-field="action"]').value).toBe('createdApexClass');
    expect(countMatches.request).toHaveBeenCalledTimes(1);
});

it('finishes monthly analysis in the background without replacing a newer history search', async () => {
    let finishChart;
    const newer = '2026-11-20T01:00:00.000Z';
    startSearch.mockResolvedValueOnce(cutoff).mockResolvedValueOnce(newer);
    countMonth.mockResolvedValueOnce(2500).mockResolvedValueOnce(3000);
    load.request.mockImplementation(({ input }) => {
        if (!input.chart) {
            return { records: [{ Id: 'first' }], nextId: 'detail', nextTime: 'time' };
        }
        return input.nextId ? new Promise(resolve => { finishChart = resolve; }) :
            { buckets: [{ action: 'change', count: 1 }], nextId: 'more', nextTime: 'time' };
    });
    countMatches.request.mockResolvedValue(1001);
    const component = mount();
    const root = component.shadowRoot;
    await flush();
    const [history, chart] = root.querySelectorAll('lightning-tab');
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    history.dispatchEvent(new CustomEvent('active'));
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    finishChart({ buckets: [{ action: 'change', count: 2000 }] });
    await flush();
    expect(root.querySelector('h2[aria-live]').textContent).toContain('3,000件');
    expect(history.textContent).toContain('1 / 2ページ');
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(root.querySelector('h2[aria-live]').textContent).toContain('2,001件');
    expect(load.request.mock.calls.filter(([{ input }]) => input.chart)).toHaveLength(2);
    chart.querySelector('c-setup-audit-trail-chart').dispatchEvent(new CustomEvent('selectfilter', { detail: { day: '2026-11-02' } }));
    await flush();
    expect(load.request.mock.lastCall[0].input).toMatchObject({ action: null, day: '2026-11-02', cutoff });
});

it.each([
    { records: [], summary: '0 / 0ページ' },
    { records: [{ Id: 'only' }], summary: '1 / 1ページ' }
])('shows $summary for a complete filtered page without a count query', async ({ records, summary }) => {
    load.request.mockResolvedValue({ records });
    const component = mount();
    await flush();
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    expect(component.shadowRoot.textContent).toContain(summary);
    expect(countMatches.request).not.toHaveBeenCalled();
});

it('limits month navigation to the current month and the six preceding months', async () => {
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    const previous = component.shadowRoot.querySelector('[data-step="-1"]');
    const next = component.shadowRoot.querySelector('[data-step="1"]');
    await flush();
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
    expect(component.shadowRoot.querySelector('.month-navigation h2').textContent).toMatch(/^\d{4}年\d{1,2}月（0件）$/);
    for (let offset = 0; offset < 6; offset += 1) {
        previous.click();
    }
    await flush();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    previous.click();
    expect(startSearch).toHaveBeenCalledTimes(7);
});


it.each([true, false])('clears data loading spinners after requests settle (success: %s)', async succeeds => {
    let resolveRequests;
    let rejectRequests;
    const pending = new Promise((resolve, reject) => {
        resolveRequests = resolve;
        rejectRequests = reject;
    });
    countMonth.mockReturnValueOnce(pending.then(() => 42));
    countMatches.request.mockReturnValueOnce(pending.then(() => 1001));
    load.request.mockResolvedValue({ records: [{ Id: 'first' }], nextId: 'cursor', nextTime: 'time' });

    const component = mount();
    const root = component.shadowRoot;
    await flush();
    expect(root.querySelector('.month-navigation lightning-spinner').alternativeText).toBe('月の総件数を取得中');
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    expect(root.querySelector('.pagination lightning-spinner').alternativeText).toBe('絞り込み件数を取得中');

    if (succeeds) {
        resolveRequests();
    } else {
        rejectRequests(new Error('Request failed'));
    }
    await flush();
    expect(root.querySelector('lightning-spinner')).toBeNull();
});

it.each([true, false])('clears the filter candidate spinner after loading (success: %s)', async succeeds => {
    let finishRequest;
    loadFilterOptions.mockImplementationOnce(() => new Promise((resolve, reject) => {
        finishRequest = () => {
            if (succeeds) {
                resolve({ options: { action: ['createdApexClass'] } });
            } else {
                reject(new Error('Request failed'));
            }
        };
    }));
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    const root = component.shadowRoot;
    await flush();

    root.querySelector('input[data-field="action"]').click();
    await flush();
    expect(root.querySelector('.slds-dropdown lightning-spinner').alternativeText).toBe('絞り込み候補を取得中');
    finishRequest();
    await flush();
    expect(root.querySelector('lightning-spinner')).toBeNull();
});

it('shares an in-flight actor lookup between the table and the open user lookup', async () => {
    const login = { Id: 'login', Action: 'suOrgAdminLogin', CreatedDate: '2026-11-21T01:00:00Z',
        Display: '対象 のログインアクセスを使用してログイン済み', DelegateUser: 'admin', CreatedById: 'admin', CreatedBy: { Username: 'admin' } };
    const logout = { ...login, Id: 'logout', Action: 'suOrgAdminLogout', CreatedDate: '2026-11-21T02:00:00Z',
        Display: '対象 のログインアクセスを使用してログアウト済み', CreatedById: 'target', CreatedBy: { Name: '対象', Username: 'target' } };
    let finish;
    loadLoginAsHistory.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    load.request.mockResolvedValue({ records: [login] });
    loadFilterOptions.mockResolvedValue({ options: {}, records: [login] });
    const root = mount().shadowRoot;
    await flush();
    root.querySelector('input[data-field="userId"]').click();
    await flush();
    finish({ records: [logout, login] });
    await flush();
    expect(loadLoginAsHistory).toHaveBeenCalledTimes(1);
    expect(root.querySelector('lightning-datatable').data[0].displayedUser).toBe('対象');
    expect(root.querySelector('[role="option"]').dataset.value).toBe('target');
});

it('queries ordinary actions for the selected creator with normal detail pagination', async () => {
    loadFilterOptions.mockResolvedValue({ options: { action: ['changedApexClass'] }, userOptions: { target: 'target' } });
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    await flush();
    await chooseLookup(component, 'userId', 'target');
    await chooseLookup(component, 'action', 'changedApexClass');
    await search(component);
    expect(load.request.mock.calls.map(([{ input }]) => input.matchIndex)).toEqual([undefined, undefined]);
    expect(load.request.mock.lastCall[0].input).toMatchObject({ action: 'changedApexClass', userId: 'target', pageSize: 1000 });
    expect(countMatches.request).not.toHaveBeenCalled();
    expect(loadLoginAsHistory).not.toHaveBeenCalled();
});

it('shows actor and delegate names on screen and indexes the section across source pages', async () => {
    const target = { Id: 'login', Action: 'suOrgAdminLogin', Display: '対象 のログインアクセスを使用してログイン済み',
        CreatedDate: '2026-11-02T03:00:00Z', CreatedById: 'admin', CreatedBy: { Username: 'admin' }, DelegateUser: 'admin', Section: 'ログイン' };
    const logout = { ...target, Id: 'logout', Action: 'suOrgAdminLogout', Display: '対象 のログインアクセスを使用してログアウト済み',
        CreatedDate: '2026-11-02T03:00:05Z', CreatedById: 'targetId', CreatedBy: { Name: '対象', Username: 'target' } };
    const changed = { Id: 'changed', CreatedById: 'service', Action: 'PermSetEntityPermChanged', Section: '権限',
        Display: '権限セット X を変更: ArchiveJobSession オブジェクト権限を 参照' };
    loadLoginAsHistory.mockResolvedValue({ records: [logout, target] });
    loadFilterOptions.mockResolvedValue({ options: { section: ['ログイン', '権限'] }, userOptions: { targetId: 'target' } });
    load.request.mockImplementation(({ input }) => {
        if (input.matchIndex) {
            return input.nextId ? { records: [target] } : { records: [logout], nextId: 'cursor', nextTime: 'time' };
        }
        if (input.chart) {
            return { buckets: [], records: [target] };
        }
        return { records: input.recordIds ? [logout, target] : [target, changed], employeeActorIds: ['service'], delegateNames: { admin: '管理者' } };
    });
    const component = mount();
    await flush();
    const table = () => component.shadowRoot.querySelector('lightning-datatable');
    expect(table().data.map(row => row.displayedUser)).toEqual(['対象', '株式会社セールスフォース・ジャパン']);
    expect(table().data.map(row => row.displayedDelegate)).toEqual(['管理者', undefined]);
    expect(table().data[1].displayedAction).toContain('アーカイブジョブセッション');
    await chooseLookup(component, 'section', 'ログイン');
    await chooseLookup(component, 'userId', 'targetId');
    await search(component);
    await flush();
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ recordIds: ['logout', 'login'] }) });
    expect(table().data.map(row => row.displayedUser)).toEqual(['対象', '対象']);
    expect(countMatches.request).not.toHaveBeenCalled();
    const chartTab = [...component.shadowRoot.querySelectorAll('lightning-tab')].find(tab => tab.value === 'chart');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(component.shadowRoot.querySelector('c-setup-audit-trail-chart').buckets[0]).toMatchObject({
        userId: 'targetId', loginName: 'target', day: '2026-11-02', section: 'ログイン'
    });
});

it('preserves the lookup through keyboard selection, IME composition and clearing', async () => {
    load.request.mockResolvedValue({ records: [] });
    const root = mount().shadowRoot;
    const input = root.querySelector('input[data-field="action"]');
    const key = (value, composing = false) => input.dispatchEvent(new KeyboardEvent('keydown', { key: value, isComposing: composing }));
    input.focus();
    await flush();
    key('ArrowDown');
    await flush();
    key('Enter', true);
    await flush();
    expect(input.getAttribute('aria-activedescendant')).toBe(root.querySelector('[role="option"]').id);
    expect(input.readOnly).toBe(false);
    key('Enter');
    await flush();
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('createdApexClass');
    expect(input.closest('.slds-has-selection')).not.toBeNull();
    key('Delete');
    await flush();
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe('');
    key('ArrowDown');
    await flush();
    key('Escape');
    await flush();
    expect(input.getAttribute('aria-expanded')).toBe('false');
});

it('allows retry inside the failed lookup and displays the returned options', async () => {
    load.request.mockResolvedValue({ records: [] });
    loadFilterOptions.mockRejectedValueOnce(new Error('error'));
    const root = mount().shadowRoot;
    root.querySelector('input[data-field="action"]').focus();
    await flush();
    const dropdown = root.querySelector('.slds-dropdown');
    expect(dropdown.querySelector('[role="alert"]')).not.toBeNull();
    dropdown.querySelector('lightning-button').click();
    await flush();
    expect(dropdown.querySelector('[role="option"]').textContent).toContain('createdApexClass');
});

it('refreshes monthly pagination and ignores the previous monthly count after search', async () => {
    let finishInitialCount;
    countMonth.mockImplementationOnce(() => new Promise(resolve => { finishInitialCount = resolve; }))
        .mockResolvedValueOnce(1001);
    // 総件数と次ページの境界はApex応答で表し、明細は各ページの代表行だけを用意する。
    const firstPage = [{ Id: 'first' }];
    load.request.mockResolvedValueOnce({ records: firstPage })
        .mockResolvedValueOnce({ records: firstPage, nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ records: [{ Id: 'last' }] });
    const component = mount();
    await flush();
    await search(component);
    finishInitialCount(1000);
    await flush();
    const root = component.shadowRoot;
    expect(root.querySelector('.month-navigation h2').textContent).toContain('1,001件');
    [...root.querySelectorAll('nav lightning-button')].find(button => button.label === '次へ').click();
    await flush();
    expect(root.querySelector('nav').textContent).toContain('2 / 2ページ');
});

it('reloads candidates after each search even if a previous options request finishes last', async () => {
    load.request.mockResolvedValue({ records: [] });
    let finishStale;
    loadFilterOptions.mockResolvedValueOnce({ options: { action: ['original'] } })
        .mockImplementationOnce(() => new Promise(resolve => { finishStale = resolve; }))
        .mockResolvedValueOnce({ options: { action: ['latest'] } });
    const component = mount();
    const root = component.shadowRoot;
    const openActions = async () => {
        root.querySelector('input[data-field="action"]').click();
        await flush();
    };
    await flush();
    await openActions();
    expect(root.querySelector('[role="option"]').dataset.value).toBe('original');
    await search(component);
    await openActions();
    expect(root.querySelector('[role="option"]')).toBeNull();
    await search(component);
    await openActions();
    finishStale({ options: { action: ['stale'] } });
    await flush();
    expect([...root.querySelectorAll('[role="option"]')].map(option => option.dataset.value)).toEqual(['latest']);
});

it.each([
    ['担当者', '担当者'],
    [null, 'viewer@example.invalid']
])('replaces the day filter and keeps the monthly chart user label on drilldown with name %s', async (userName, label) => {
    const userId = 'target';
    load.request.mockImplementation(({ input }) => (input.chart
        ? { buckets: [{ userId, userName, loginName: 'viewer@example.invalid', day: input.monthStart, count: 1 }] }
        : { records: [] }));
    const component = mount();
    const root = component.shadowRoot;
    await flush();
    const day = load.request.mock.calls[0][0].input.monthStart;
    root.querySelector('[data-field="day"]').dispatchEvent(new CustomEvent('change', { detail: { value: day } }));
    await search(component);
    root.querySelectorAll('lightning-tab')[1].dispatchEvent(new CustomEvent('active'));
    await flush();
    const chart = root.querySelector('c-setup-audit-trail-chart');
    chart.shadowRoot.querySelector('section[aria-label="ユーザー"] button').click();
    await flush();
    expect(root.querySelector('input[data-field="userId"]').value).toBe(label);
    expect(load.request.mock.lastCall[0].input).toMatchObject({ day: null, userId, matchIndex: true });
    expect(loadFilterOptions).not.toHaveBeenCalled();
});

it('uses the actual last page when a delayed filtered count includes unavailable pages', async () => {
    let finishCount;
    countMatches.request.mockImplementation(() => new Promise(resolve => { finishCount = resolve; }));
    load.request.mockImplementation(({ input }) => (input.nextId ? { records: [{ Id: 'last' }] } :
        { records: [{ Id: 'first' }], nextId: 'second-page', nextTime: 'time' }));
    const component = mount();
    await flush();
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    component.shadowRoot.querySelector('nav lightning-button').click();
    await flush();
    finishCount(2001);
    await flush();
    expect(component.shadowRoot.querySelector('nav').textContent).toContain('2 / 2ページ');
});

it('hides an obsolete monthly page count when the cursor already proves another page exists', async () => {
    countMonth.mockResolvedValue(1000);
    load.request.mockResolvedValue({ records: [{ Id: 'first' }], nextId: 'next', nextTime: 'time' });
    const component = mount();
    await flush();
    expect(component.shadowRoot.querySelector('nav').textContent).toBe('1ページ');
    expect(component.shadowRoot.querySelector('nav lightning-button').label).toBe('次へ');
});

it('can retry a failed filtered count without reloading the visible records', async () => {
    countMatches.request.mockRejectedValueOnce(new Error('count')).mockResolvedValueOnce(1001);
    load.request.mockResolvedValue({ records: [{ Id: 'first' }], nextId: 'next', nextTime: 'time' });
    const component = mount();
    await flush();
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    const nav = component.shadowRoot.querySelector('nav');
    const reads = load.request.mock.calls.length;
    const retry = [...nav.querySelectorAll('lightning-button')].find(item => item.label === '絞り込み件数を再取得');
    expect(retry).toBeDefined();
    retry.click();
    await flush();
    expect(load.request).toHaveBeenCalledTimes(reads);
    expect(nav.textContent).toContain('1 / 2ページ');
    expect([...nav.querySelectorAll('lightning-button')].map(item => item.label)).toEqual(['次へ']);
});

it('returns to available history if records beyond the saved cursor have expired', async () => {
    startSearch.mockResolvedValueOnce(cutoff).mockResolvedValueOnce('2026-11-20T01:00:00.000Z');
    countMonth.mockResolvedValueOnce(1001).mockResolvedValueOnce(1);
    load.request.mockResolvedValueOnce({ records: [{ Id: 'first' }], nextId: 'expired', nextTime: 'time' })
        .mockResolvedValueOnce({ records: [] }).mockResolvedValueOnce({ records: [{ Id: 'remaining' }] });
    const component = mount();
    await flush();
    const root = component.shadowRoot;
    root.querySelector('nav lightning-button').click();
    await flush();
    expect(load.request.mock.calls.map(([{ input }]) => input.cutoff)).toEqual([cutoff, cutoff, cutoff]);
    expect(countMonth.mock.calls.map(([input]) => input.cutoff)).toEqual([cutoff, cutoff]);
    expect(root.querySelector('nav').textContent).toContain('1 / 1ページ');
    expect(root.querySelector('lightning-datatable').data.map(row => row.Id)).toEqual(['remaining']);
    expect(root.querySelector('.month-navigation h2').textContent).toContain('（1件）');
});

it('shows a full matched page while probing later source batches and resumes at the next match', async () => {
    // 3行で本番と同じ先読み境界を作る。
    jest.replaceProperty(historyLogic, 'PAGE_SIZE', 2);
    let finishProbe;
    let probeReads = 0;
    loadFilterOptions.mockResolvedValue({ options: { section: ['A'] } });
    load.request.mockImplementation(({ input }) => {
        if (input.matchIndex) {
            if (!input.nextId) {
                return { records: [{ Id: 'a' }, { Id: 'b' }], nextId: 'b', nextTime: 'time' };
            }
            if (input.nextId === 'b') {
                return { records: [], nextId: 'skip', nextTime: 'time' };
            }
            if (++probeReads === 1) {
                return new Promise(resolve => { finishProbe = resolve; });
            }
            return { records: [{ Id: 'c' }] };
        }
        return { records: (input.recordIds || []).map(Id => ({ Id })) };
    });
    const component = mount();
    await flush();
    await chooseLookup(component, 'section', 'A');
    await search(component);
    const root = component.shadowRoot;
    const rows = () => root.querySelector('lightning-datatable').data.map(row => row.Id);
    expect(rows()).toEqual(['a', 'b']);
    expect(root.querySelector('nav [aria-live]').textContent).toBe('1ページ');
    expect(root.querySelector('nav [role="status"]').textContent).toContain('次の一致を確認中');
    expect(root.querySelector('nav lightning-button')).toBeNull();
    finishProbe({ records: [{ Id: 'c' }] });
    await flush();
    root.querySelector('nav lightning-button').click();
    await flush();
    expect(rows()).toEqual(['c']);
    expect(root.querySelector('nav').textContent).toBe('2 / 2ページ');
    expect(probeReads).toBe(1);
});

it('uses one server cutoff across views and renews it on explicit search', async () => {
    const newer = '2026-11-20T01:00:00.000Z';
    startSearch.mockResolvedValueOnce(cutoff).mockResolvedValueOnce(newer);
    load.request.mockImplementation(({ input }) => (input.chart ? { buckets: [] } : { records: [] }));
    const component = mount();
    await flush();
    component.shadowRoot.querySelector('input[data-field="action"]').click();
    await flush();
    expect(JSON.parse(loadFilterOptions.mock.lastCall[0].criteriaJson)).toEqual({
        monthStart: load.request.mock.calls[0][0].input.monthStart, cutoff
    });
    const chart = component.shadowRoot.querySelector('lightning-tab[value="chart"]') ||
        [...component.shadowRoot.querySelectorAll('lightning-tab')].find(item => item.value === 'chart');
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request.mock.calls.map(([{ input }]) => input.cutoff)).toEqual([cutoff, cutoff]);
    component.shadowRoot.querySelectorAll('lightning-tab')[0].dispatchEvent(new CustomEvent('active'));
    await flush();
    await search(component);
    expect(load.request.mock.lastCall[0].input.cutoff).toBe(newer);
    expect(countMonth.mock.calls.map(([input]) => input.cutoff)).toEqual([cutoff, newer]);
});

it('cancels a confirmed CSV export and ignores its outstanding page', async () => {
    let finish;
    exportAllHistory.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    await flush();
    const root = component.shadowRoot;
    root.querySelector('lightning-button-menu').dispatchEvent(new CustomEvent('select', { detail: { value: 'all' } }));
    confirmCsv(component);
    await flush();
    expect(root.querySelector('dialog [role="status"]').textContent).toContain('0件取得済み');
    root.querySelector('dialog').dispatchEvent(new CustomEvent('cancel', { cancelable: true }));
    finish({ records: [], nextId: 'later', nextTime: 'time' });
    await flush();
    expect(root.querySelector('dialog[open]')).toBeNull();
    expect(exportAllHistory).toHaveBeenCalledTimes(1);
});

it('reuses five pages and refetches the evicted page with the original cutoff', async () => {
    countMonth.mockResolvedValue(6000);
    load.request.mockImplementation(({ input }) => {
        const page = Number(input.nextId ?? 1);
        return { records: [{ Id: String(page) }], ...(page < 6 ? { nextId: String(page + 1), nextTime: 'time' } : {}) };
    });
    const component = mount();
    await flush();
    const root = component.shadowRoot;
    async function move(label) {
        [...root.querySelectorAll('nav lightning-button')].find(button => button.label === label).click();
        await flush();
    }
    function visit(pages, direction) {
        return pages.reduce((previous, page) => previous.then(async () => {
            await move(direction);
            expect(root.querySelector('lightning-datatable').data[0].Id).toBe(String(page));
        }), Promise.resolve());
    }
    await visit([2, 3, 4, 5, 6], '次へ');
    await visit([5, 4, 3, 2], '前へ');
    expect(load.request).toHaveBeenCalledTimes(6);
    await move('前へ');
    expect(load.request).toHaveBeenCalledTimes(7);
    expect(load.request.mock.lastCall[0].input).toMatchObject({ cutoff });
    expect(root.querySelector('lightning-datatable').data[0].Id).toBe('1');
});

it('preserves the indexed history page on a tab round trip and clears the section on drilldown', async () => {
    jest.replaceProperty(historyLogic, 'PAGE_SIZE', 2);
    const rows = ['c', 'b', 'a'].map(Id => ({ Id, CreatedDate: 'time' }));
    loadFilterOptions.mockResolvedValue({ options: { section: ['A'] } });
    load.request.mockImplementation(({ input }) => {
        if (input.matchIndex) {
            return { records: input.nextId === 'b' ? rows.slice(2) : rows };
        }
        if (input.chart) {
            return { buckets: [{ action: 'change', count: rows.length }] };
        }
        return { records: rows.filter(row => input.recordIds?.includes(row.Id)) };
    });
    const component = mount();
    await flush();
    await chooseLookup(component, 'section', 'A');
    await search(component);
    const root = component.shadowRoot;
    root.querySelector('nav lightning-button').click();
    await flush();
    expect(root.querySelector('lightning-datatable').data.map(row => row.Id)).toEqual(['a']);
    const chartTab = [...root.querySelectorAll('lightning-tab')].find(item => item.value === 'chart');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    const chart = root.querySelector('c-setup-audit-trail-chart');
    expect(chart.buckets[0].count).toBe(3);
    expect(load.request.mock.calls.filter(([{ input }]) => input.matchIndex)).toHaveLength(1);
    const reads = load.request.mock.calls.length;
    root.querySelectorAll('lightning-tab')[0].dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(root.querySelector('lightning-datatable').data.map(row => row.Id)).toEqual(['a']);
    expect(root.querySelector('nav').textContent).toContain('2 / 2ページ');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request.mock.calls).toHaveLength(reads);
    const starts = startSearch.mock.calls.length;
    chart.dispatchEvent(new CustomEvent('selectfilter', { detail: { action: 'change' } }));
    await flush();
    expect(startSearch).toHaveBeenCalledTimes(starts);
    expect(load.request.mock.lastCall[0].input).toMatchObject({ action: 'change', cutoff, pageSize: 2 });
    expect(load.request.mock.lastCall[0].input.section).toBeUndefined();
});

it('retains monthly lookup options from the chart until the next explicit search', async () => {
    load.request.mockImplementation(({ input }) => (input.chart
        ? { buckets: [{ action: 'change', section: 'A', count: 1 }] }
        : { records: [] }));
    loadFilterOptions.mockResolvedValue({ options: { section: ['B'] } });
    const component = mount();
    const root = component.shadowRoot;
    await flush();
    root.querySelectorAll('lightning-tab')[1].dispatchEvent(new CustomEvent('active'));
    await flush();
    root.querySelector('c-setup-audit-trail-chart').dispatchEvent(new CustomEvent('selectfilter', { detail: { action: 'change' } }));
    await flush();
    const openSections = async () => {
        root.querySelector('input[data-field="section"]').click();
        await flush();
        return [...root.querySelectorAll('[role="option"]')].map(item => item.dataset.value);
    };
    expect(await openSections()).toEqual(['A']);
    expect(loadFilterOptions).not.toHaveBeenCalled();
    await search(component);
    expect(await openSections()).toEqual(['B']);
    expect(loadFilterOptions).toHaveBeenCalledTimes(1);
});

it('retries the visible detail page before probing more matches after actor lookup fails', async () => {
    jest.replaceProperty(historyLogic, 'PAGE_SIZE', 1);
    const login = { Id: 'first', CreatedDate: cutoff, Action: 'suOrgAdminLogin', DelegateUser: 'admin',
        CreatedBy: { Username: 'admin' }, Display: '対象 のログインアクセスを使用してログイン済み' };
    loadFilterOptions.mockResolvedValue({ options: { section: ['A'] } });
    loadLoginAsHistory.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ records: [] });
    load.request.mockImplementation(({ input }) => {
        if (input.matchIndex && !input.nextId) {
            return { records: [login], nextId: login.Id, nextTime: cutoff };
        }
        return { records: input.recordIds ? [login] : [] };
    });
    const component = mount();
    await flush();
    await chooseLookup(component, 'section', 'A');
    await search(component);
    const root = component.shadowRoot;
    expect(root.querySelector('lightning-datatable')).toBeNull();
    [...root.querySelectorAll('lightning-button')].find(button => button.label === '再試行').click();
    await flush();
    expect(root.querySelector('lightning-datatable').data.map(row => row.Id)).toEqual(['first']);
    expect(root.querySelector('nav').textContent).toContain('1 / 1ページ');
});

it('keeps a long lookup bounded while scrolling, choosing the last item and searching all candidates', async () => {
    const actions = Array.from({ length: 20 }, (_, index) => 'action' + String(index).padStart(2, '0'));
    loadFilterOptions.mockResolvedValue({ options: { action: actions } });
    load.request.mockResolvedValue({ records: [] });
    const root = mount().shadowRoot;
    const input = root.querySelector('input[data-field="action"]');
    const key = value => input.dispatchEvent(new KeyboardEvent('keydown', { key: value }));
    input.focus();
    await flush();
    const options = () => [...root.querySelectorAll('[role="option"]')];
    const initialLength = options().length;
    expect(initialLength).toBeLessThan(actions.length);
    expect(options()[0].dataset.value).toBe(actions[0]);
    const list = root.querySelector('[role="listbox"]');
    options()[0].getBoundingClientRect = () => ({ height: 32 });
    list.scrollTop = 480;
    list.dispatchEvent(new CustomEvent('scroll'));
    await flush();
    expect(options()).toHaveLength(initialLength);
    expect(options().at(-1).dataset.value).toBe(actions.at(-1));
    key('ArrowUp');
    await flush();
    expect(input.getAttribute('aria-activedescendant')).toBe(options().at(-1).id);
    key('Enter');
    await flush();
    expect(input.value).toBe(actions.at(-1));
    key('Delete');
    await flush();
    input.value = '19';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    expect(options().map(option => option.dataset.value)).toEqual([actions.at(-1)]);
    options()[0].click();
    await flush();
    expect(input.value).toBe(actions.at(-1));
    expect(loadFilterOptions).toHaveBeenCalledTimes(1);
});

it.each(['before', 'after'])('uses a complete monthly chart if the monthly count fails %s analysis', async timing => {
    let failCount;
    let finishChart;
    countMonth.mockImplementationOnce(() => new Promise((resolve, reject) => { failCount = reject; }));
    load.request.mockResolvedValueOnce({ records: [{ Id: 'first' }], nextId: 'detail', nextTime: 'time' })
        .mockResolvedValueOnce({ buckets: [{ count: 1000 }], nextId: 'chart', nextTime: 'time' })
        .mockImplementationOnce(() => new Promise(resolve => { finishChart = resolve; }));
    const root = mount().shadowRoot;
    const retryShown = () => [...root.querySelectorAll('lightning-button')].some(button => button.label === '総件数を再取得');
    await flush();
    const [history, chart] = root.querySelectorAll('lightning-tab');
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    if (timing === 'before') {
        failCount(new Error('count'));
        await flush();
    }
    expect(retryShown()).toBe(timing === 'before');
    expect(root.querySelector('.month-navigation h2').textContent).not.toContain('件');
    finishChart({ buckets: [{ count: 1 }] });
    await flush();
    if (timing === 'after') {
        failCount(new Error('count'));
        await flush();
    }
    expect(root.querySelector('.month-navigation h2').textContent).toContain('（1,001件）');
    expect(retryShown()).toBe(false);
    history.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(root.querySelector('nav').textContent).toContain('1 / 2ページ');
    expect(countMonth).toHaveBeenCalledTimes(1);
});

it('retries only the failed chart page with the same snapshot and counts it once', async () => {
    load.request.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ buckets: [{ action: 'change', count: 2 }], nextId: 'next', nextTime: 'time' })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ buckets: [{ action: 'change', count: 1 }] });
    const root = mount().shadowRoot;
    await flush();
    root.querySelectorAll('lightning-tab')[1].dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request.mock.calls.map(([{ input }]) => input.nextId)).toEqual([undefined, undefined, 'next', 'next']);
    expect(load.request.mock.calls[2]).toEqual(load.request.mock.calls[3]);
    expect(root.querySelector('c-setup-audit-trail-chart').buckets).toEqual([{ action: 'change', count: 3 }]);
});

it('keeps a failed monthly analysis retry separate from the visible history tab', async () => {
    let failChart;
    load.request.mockResolvedValueOnce({ records: [{ Id: 'first' }] })
        .mockImplementationOnce(() => new Promise((resolve, reject) => { failChart = reject; }));
    const root = mount().shadowRoot;
    await flush();
    const [history, chart] = root.querySelectorAll('lightning-tab');
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    history.dispatchEvent(new CustomEvent('active'));
    load.request.mockRejectedValueOnce({ status: 503, body: { message: '集計エラー' } });
    failChart({ status: 503 });
    await flush();
    expect(load.request).toHaveBeenCalledTimes(3);
    expect(history.querySelector('lightning-datatable').data[0].Id).toBe('first');
    expect(history.querySelector('[role="alert"]')).toBeNull();
    expect(chart.querySelector('[role="alert"]').textContent).toContain('集計エラー');
    load.request.mockResolvedValueOnce({ buckets: [] });
    chart.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(chart.querySelector('[role="alert"]')).toBeNull();
    expect(chart.textContent).toContain('この月の設定変更履歴はありません。');
});

it('closes the unfinished lookup on reconnect and uses fresh candidates when reopened', async () => {
    let finishOldOptions;
    loadFilterOptions.mockImplementationOnce(() => new Promise(resolve => { finishOldOptions = resolve; }))
        .mockResolvedValueOnce({ options: { action: ['current'] } });
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    const action = () => component.shadowRoot.querySelector('input[data-field="action"]');
    action().click();
    await flush();
    component.remove();
    document.body.appendChild(component);
    await flush();
    expect(action().getAttribute('aria-expanded')).toBe('false');
    expect(loadFilterOptions).toHaveBeenCalledTimes(1);
    action().click();
    await flush();
    finishOldOptions({ options: { action: ['obsolete'] } });
    await flush();
    expect([...component.shadowRoot.querySelectorAll('[role="option"]')].map(row => row.dataset.value)).toEqual(['current']);
});

it('restores an open lookup and its typed search after recovering an expired page', async () => {
    let finishPage;
    let finishOldOptions;
    load.request.mockResolvedValueOnce({ records: [{ Id: 'first' }], nextId: 'expired', nextTime: 'time' })
        .mockImplementationOnce(() => new Promise(resolve => { finishPage = resolve; }))
        .mockResolvedValueOnce({ records: [{ Id: 'remaining' }] });
    loadFilterOptions.mockImplementationOnce(() => new Promise(resolve => { finishOldOptions = resolve; }))
        .mockResolvedValueOnce({ options: { action: ['change', 'create'] } });
    const root = mount().shadowRoot;
    await flush();
    root.querySelector('nav lightning-button').click();
    const input = root.querySelector('input[data-field="action"]');
    input.click();
    input.value = 'chan';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    finishPage({ records: [] });
    await flush();
    finishOldOptions({ options: { action: ['changedObsolete'] } });
    await flush();
    expect(input.value).toBe('chan');
    expect([...root.querySelectorAll('[role="option"]')].map(row => row.dataset.value)).toEqual(['change']);
    expect(loadFilterOptions).toHaveBeenCalledTimes(2);
    expect(startSearch).toHaveBeenCalledTimes(1);
});

it.each(['lookup', 'chart'])('offers name-only users by ID from %s data, including delegated logins', async source => {
    const delegated = { Id: 'login', Action: 'suOrgAdminLogin', CreatedDate: '2026-11-01T00:00:00Z',
        CreatedById: 'other', CreatedBy: { Name: '同じ氏名' } };
    load.request.mockImplementation(({ input }) => (input.chart ?
        { buckets: [{ userId: 'first', userName: '同じ氏名', count: 1 }, { userId: 'noLabel', count: 1 }], records: [delegated] } :
        { records: [] }));
    loadFilterOptions.mockResolvedValueOnce({ options: {}, userNames: { first: '同じ氏名' }, records: [delegated] });
    const component = mount();
    const root = component.shadowRoot;
    await flush();
    if (source === 'chart') {
        root.querySelectorAll('lightning-tab')[1].dispatchEvent(new CustomEvent('active'));
        await flush();
        root.querySelectorAll('lightning-tab')[0].dispatchEvent(new CustomEvent('active'));
        await flush();
    }
    const input = root.querySelector('input[data-field="userId"]');
    input.click();
    await flush();
    expect([...root.querySelectorAll('[role="option"]')].map(option =>
        [option.dataset.value, ...[...option.firstElementChild.children].map(line => line.textContent)]
    ).sort()).toEqual([['first', '同じ氏名', 'first'], ['other', '同じ氏名', 'other']]);
    input.value = 'other';
    input.dispatchEvent(new CustomEvent('input'));
    await flush();
    root.querySelector('[role="option"]').click();
    await search(component);
    expect(load.request.mock.lastCall[0].input.userId).toBe('other');
    expect(input.value).toBe('同じ氏名');
});
