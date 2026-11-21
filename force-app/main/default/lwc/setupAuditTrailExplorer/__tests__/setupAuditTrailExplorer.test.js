import { createElement } from 'lwc';
import Explorer from 'c/setupAuditTrailExplorer';
import countMatches from '@salesforce/apex/SetupAuditTrailExplorerController.countMatches';
import countMonth from '@salesforce/apex/SetupAuditTrailExplorerController.countMonth';
import loadFilterOptions from '@salesforce/apex/SetupAuditTrailExplorerController.loadDistinctFilterOptions';
import exportAllHistory from '@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory';
import loadLoginAsHistory from '@salesforce/apex/SetupAuditTrailExplorerController.loadLoginAsHistory';
import load from '@salesforce/apex/SetupAuditTrailExplorerController.load';

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.load', () => {
    const request = jest.fn();
    return { default: Object.assign(({
        criteriaJson
    }) => request({ input: JSON.parse(criteriaJson) }), { request }) };
}, { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.countMonth', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.countMatches', () => {
    const request = jest.fn();
    return { default: Object.assign(({
        criteriaJson
    }) => request({ input: JSON.parse(criteriaJson) }), { request }) };
}, { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.loadDistinctFilterOptions', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.loadLoginAsHistory', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/i18n/lang', () => ({ default: 'ja' }), { virtual: true });

beforeEach(() => {
    loadFilterOptions.mockResolvedValue({ options: { action: ['createdApexClass'], namespacePrefix: [], delegateUser: [] } });
    countMonth.mockResolvedValue(0);
    countMatches.request.mockResolvedValue(0);
});

jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Asia/Tokyo' }), { virtual: true });


const flush = async () => {
    for (let index = 0; index < 8; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
};

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
    const delegatedBucket = { ...bucket, delegateUser: '代理ユーザー' };
    load.request.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ buckets: [{ ...bucket, count: 2 }], nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ buckets: [{ ...bucket, count: 3 }, { ...namespacedBucket, count: 1 }, { ...delegatedBucket, count: 4 }] });
    const component = mount();
    await flush();
    const [, chartTab] = component.shadowRoot.querySelectorAll('lightning-tab');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ chart: true, nextId: 'cursor', nextTime: 'time' }) });
    expect(component.shadowRoot.querySelector('c-setup-audit-trail-chart').buckets).toEqual([
        { ...bucket, count: 5 },
        { ...namespacedBucket, count: 1 },
        { ...delegatedBucket, count: 4 }
    ]);
    await chooseLookup(component, 'namespacePrefix', 'sample');
    await chooseLookup(component, 'delegateUser', '代理ユーザー');
    expect(loadFilterOptions).not.toHaveBeenCalled();
});

it('uses the recorded user for lookup and chart when the delegate is a different user', async () => {
    const login = { Id: 'login', Action: 'suOrgAdminLogin', CreatedDate: '2026-11-02T03:00:00Z',
        CreatedById: 'target', CreatedBy: { Name: '対象', Username: 'target@example.invalid' }, DelegateUser: 'admin@example.invalid' };
    load.request.mockResolvedValueOnce({ records: [] }).mockResolvedValueOnce({ buckets: [], records: [login] });
    loadFilterOptions.mockResolvedValue({ options: {}, records: [login] });
    const root = mount().shadowRoot;
    await flush();
    root.querySelector('input[data-field="userId"]').click();
    await flush();
    expect(root.querySelector('[role="option"]').textContent).toContain('対象');
    root.querySelectorAll('lightning-tab')[1].dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(root.querySelector('c-setup-audit-trail-chart').buckets[0]).toMatchObject({ userId: 'target', count: 1 });
    expect(loadLoginAsHistory).not.toHaveBeenCalled();
});

it('loads candidates on demand and applies selected filters only on search', async () => {
    load.request.mockResolvedValue({ records: [] });
    loadFilterOptions.mockResolvedValueOnce({
        options: { action: [], namespacePrefix: ['first'], delegateUser: [] }, nextId: 'cursor', nextTime: 'time'
    }).mockResolvedValueOnce({
        options: { action: [], namespacePrefix: ['first', 'second'], delegateUser: ['代理ユーザー'] }
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
    await chooseLookup(component, 'delegateUser', '代理ユーザー');
    await search(component);
    expect(load.request).toHaveBeenCalledTimes(2);
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ namespacePrefix: 'second', delegateUser: '代理ユーザー' }) });
    await chooseLookup(component, 'namespacePrefix', '');
    await search(component);
    expect(component.shadowRoot.querySelector('input[data-field="namespacePrefix"]').value).toBe('');
    expect(component.shadowRoot.querySelector('input[data-field="delegateUser"]').value).toBe('代理ユーザー');
    component.shadowRoot.querySelector('input[data-field="namespacePrefix"]').click();
    await flush();
    expect(loadFilterOptions).toHaveBeenCalledTimes(2);
    expect(load.request.mock.lastCall[0].input).not.toHaveProperty('namespacePrefix');
});

it('shows raw action codes and month users', async () => {
    const userId = '005000000000001';
    load.request.mockResolvedValue({ records: [] });
    loadFilterOptions.mockResolvedValue({
        options: { action: ['filteredLookupActivate'], namespacePrefix: [], delegateUser: [] },
        userOptions: { [userId]: 'audit@example.invalid' },
        userNames: { [userId]: '山田 太郎' }
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
    expect(component.shadowRoot.querySelector('input[data-field="userId"]').value).toBe('audit@example.invalid');
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
            cutoff: period === 'all' ? serverCutoff : null, employeeActorIds: ['employee'] })
            .mockResolvedValueOnce({ records: [{ ...row, CreatedById: 'employee', CreatedBy: null }, login], cutoff: period === 'all' ? serverCutoff : null });
        const monthStart = load.request.mock.calls[0][0].input.monthStart;
        const menu = component.shadowRoot.querySelector('lightning-button-menu');
        expect(menu.querySelector('lightning-menu-item').label).toBe('CSV出力 (全期間)');
        const startedAt = Date.UTC(2026, 10, 19, 13, 38, 7, 912);
        const clock = jest.spyOn(Date, 'now').mockReturnValue(startedAt);
        if (period === 'month') {
            [...component.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === 'CSV出力').click();
        } else {
            menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'all' } }));
        }
        clock.mockReturnValue(startedAt + 5000);
        await downloaded;

        const queries = period === 'month'
            ? load.request.mock.calls.slice(2).map(([request]) => request.input)
            : exportAllHistory.mock.calls.map(([request]) => request);
        const monthQuery = { monthStart, csv: true };
        expect(queries).toEqual([
            period === 'month' ? monthQuery : { cutoff: null },
            { ...(period === 'month' ? monthQuery : { cutoff: serverCutoff }), nextId: 'cursor', nextTime: 'time' }
        ]);
        expect(download).toHaveBeenCalledTimes(1);
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
            { cutoff: period === 'all' ? serverCutoff : null },
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
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    await flush();
    expect(component.shadowRoot.textContent).toContain('月（21,638件）');
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    expect(countMonth).toHaveBeenCalledTimes(1);
    expect(countMatches.request).toHaveBeenCalledTimes(1);
    expect(countMatches.request).toHaveBeenCalledWith({ input: expect.objectContaining({ action: 'createdApexClass' }) });
    expect(component.shadowRoot.textContent).toContain('月（21,638件）');
});

it('moves through adjacent pages and resets the cursor only after search', async () => {
    countMonth.mockResolvedValue(402);
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
    expect(load.request.mock.calls[0][0].input).toMatchObject({ pageSize: 200, chart: false });
    button('次へ').click();
    await flush();
    expect(root.textContent).toContain('2 / 3ページ');
    expect(root.querySelector('lightning-datatable').rowNumberOffset).toBe(200);
    button('次へ').click();
    await flush();
    expect(root.textContent).toContain('3 / 3ページ');
    expect(button('次へ')).toBeUndefined();
    button('前へ').click();
    await flush();
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({ nextId: 'cursor-2' }) });

    await chooseLookup(component, 'action', 'createdApexClass');
    expect(root.textContent).toContain('2 / 3ページ');
    await search(component);
    expect(load.request.mock.calls.at(-1)[0].input).not.toHaveProperty('nextId');
    expect(root.textContent).toContain('0 / 0ページ');
});

it('shows 1 / 1 even when neither adjacent page exists', async () => {
    countMonth.mockResolvedValue(1);
    load.request.mockResolvedValue({ records: [{ Id: 'row' }] });
    const component = mount();
    await flush();
    const pagination = component.shadowRoot.querySelector('nav');
    expect(pagination.textContent).toContain('1 / 1ページ');
    expect(pagination.querySelector('lightning-button')).toBeNull();
});

it('defers filtered result counts until the history tab is opened', async () => {
    load.request.mockImplementation(({ input: { chart } }) => Promise.resolve(chart ? { buckets: [] } : { records: [] }));
    const component = mount();
    await flush();
    const [historyTab, chartTab] = component.shadowRoot.querySelectorAll('lightning-tab');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();

    component.shadowRoot.querySelector('lightning-combobox[data-field="day"]')
        .dispatchEvent(new CustomEvent('change', { detail: { value: load.request.mock.calls[0][0].input.monthStart } }));
    await search(component);
    expect(load.request).toHaveBeenLastCalledWith({ input: expect.objectContaining({
        chart: true, day: load.request.mock.calls[0][0].input.monthStart
    }) });
    expect(countMatches.request).not.toHaveBeenCalled();

    historyTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(countMatches.request).toHaveBeenCalledTimes(1);
    chartTab.dispatchEvent(new CustomEvent('active'));
    historyTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(countMatches.request).toHaveBeenCalledTimes(1);
});

it('limits month navigation to the current month and the six preceding months', async () => {
    load.request.mockResolvedValue({ records: [] });
    const component = mount();
    const previous = component.shadowRoot.querySelector('[data-step="-1"]');
    const next = component.shadowRoot.querySelector('[data-step="1"]');
    await flush();
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
    expect(component.shadowRoot.querySelector('h2').textContent).toMatch(/^\d{4}年\d{1,2}月（0件）$/);
    for (let offset = 0; offset < 6; offset += 1) {
        previous.click();
    }
    await flush();
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    previous.click();
    expect(countMonth).toHaveBeenCalledTimes(7);
});


it.each([true, false])('clears data loading spinners after requests settle (success: %s)', async succeeds => {
    let resolveRequests;
    let rejectRequests;
    const pending = new Promise((resolve, reject) => {
        resolveRequests = resolve;
        rejectRequests = reject;
    });
    countMonth.mockReturnValueOnce(pending.then(() => 42));
    countMatches.request.mockReturnValueOnce(pending.then(() => 1));
    load.request.mockResolvedValue({ records: [] });

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
    expect(load.request.mock.lastCall[0].input).toMatchObject({ action: 'changedApexClass', userId: 'target', pageSize: 200 });
    expect(countMatches.request).toHaveBeenCalledTimes(1);
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
