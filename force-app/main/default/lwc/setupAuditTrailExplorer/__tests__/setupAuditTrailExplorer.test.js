import { createElement } from 'lwc';
import Explorer from 'c/setupAuditTrailExplorer';
import countMatches from '@salesforce/apex/SetupAuditTrailExplorerController.countMatches';
import countMonth from '@salesforce/apex/SetupAuditTrailExplorerController.countMonth';
import loadFilterOptions from '@salesforce/apex/SetupAuditTrailExplorerController.loadDistinctFilterOptions';
import exportAllHistory from '@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory';
import load from '@salesforce/apex/SetupAuditTrailExplorerController.load';

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.load', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.countMonth', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.countMatches', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.loadDistinctFilterOptions', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('@salesforce/apex/SetupAuditTrailExplorerController.exportAllHistory', () => ({ default: jest.fn() }), { virtual: true });

beforeEach(() => {
    loadFilterOptions.mockResolvedValue({ options: { action: ['createdApexClass'], namespacePrefix: [], delegateUser: [] } });
    countMonth.mockResolvedValue(0);
    countMatches.mockResolvedValue(0);
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
    load.mockReset();
    countMonth.mockReset();
    countMatches.mockReset();
    jest.restoreAllMocks();
});

it('merges chart buckets across pages and reuses them as filter options', async () => {
    const bucket = { day: '2026-11-18', userId: '005000000000001', action: 'createdApexClass' };
    const namespacedBucket = { ...bucket, namespacePrefix: 'sample' };
    const delegatedBucket = { ...bucket, delegateUser: '代理ユーザー' };
    load.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ buckets: [{ ...bucket, count: 2 }], nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ buckets: [{ ...bucket, count: 3 }, { ...namespacedBucket, count: 1 }, { ...delegatedBucket, count: 4 }] });
    const component = mount();
    await flush();
    const [, chartTab] = component.shadowRoot.querySelectorAll('lightning-tab');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ chart: true, nextId: 'cursor', nextTime: 'time' }));
    expect(component.shadowRoot.querySelector('c-setup-audit-trail-chart').buckets).toEqual([
        { ...bucket, count: 5 },
        { ...namespacedBucket, count: 1 },
        { ...delegatedBucket, count: 4 }
    ]);
    await chooseLookup(component, 'namespacePrefix', 'sample');
    await chooseLookup(component, 'delegateUser', '代理ユーザー');
    expect(loadFilterOptions).not.toHaveBeenCalled();
});

it('loads candidates on demand and applies selected filters only on search', async () => {
    load.mockResolvedValue({ records: [] });
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
    expect(load).toHaveBeenCalledTimes(1);
    expect(countMatches).not.toHaveBeenCalled();
    await chooseLookup(component, 'delegateUser', '代理ユーザー');
    await search(component);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ namespacePrefix: 'second', delegateUser: '代理ユーザー' }));
    await chooseLookup(component, 'namespacePrefix', '');
    await search(component);
    expect(component.shadowRoot.querySelector('input[data-field="namespacePrefix"]').value).toBe('');
    component.shadowRoot.querySelector('input[data-field="delegateUser"]').click();
    await flush();
    expect(loadFilterOptions).toHaveBeenCalledTimes(2);
    expect(load.mock.lastCall[0]).not.toHaveProperty('namespacePrefix');
});

it('shows raw action codes and month users', async () => {
    const userId = '005000000000001';
    load.mockResolvedValue({ records: [] });
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
    expect(userOption.firstElementChild.children[1].textContent).toBe(userId);
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
    expect(selectedAction.readOnly).toBe(true);
    await search(component);
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ userId, action: 'filteredLookupActivate' }));

    component.shadowRoot.querySelector('input[data-field="delegateUser"]').click();
    await flush();
    expect(component.shadowRoot.textContent).toContain('候補がありません。');
    expect(component.shadowRoot.querySelector('[role="option"]')).toBeNull();
});

it('retries the same list page after a request fails', async () => {
    load.mockRejectedValueOnce({ body: { message: '取得エラー' } }).mockResolvedValueOnce({ records: [] });
    const component = mount();
    await flush();
    const retry = [...component.shadowRoot.querySelectorAll('lightning-button')].find(button => button.label === '再試行');
    retry.click();
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[0]).toEqual(load.mock.calls[1]);
    expect(component.shadowRoot.textContent).toContain('条件に一致する設定変更履歴はありません。');
});

it('exports the whole month as UTF-8 without changing log text', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const download = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const row = {
        CreatedDate: '2026-11-18T00:00:00.000Z',
        CreatedBy: { Username: 'audit@example.invalid' },
        ResponsibleNamespacePrefix: 'sample',
        Display: '=原文,"引用"\n続き🧪',
        Section: 'Apps',
        DelegateUser: 'delegate@example.invalid'
    };
    URL.createObjectURL = jest.fn(() => 'blob:audit');
    URL.revokeObjectURL = jest.fn();
    load.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [row], nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ records: [row] });
    const component = mount();
    try {
        await flush();
        await chooseLookup(component, 'action', 'createdApexClass');
        await search(component);
        const button = [...component.shadowRoot.querySelectorAll('lightning-button')]
            .find(child => child.label === 'CSV出力');
        button.click();
        await flush();
        const monthStart = load.mock.calls[0][0].monthStart;
        expect(load.mock.calls.slice(2)).toEqual([
            [{ monthStart, csv: true }],
            [{ monthStart, csv: true, nextId: 'cursor', nextTime: 'time' }]
        ]);
        expect(download).toHaveBeenCalledTimes(1);
        const [blob] = URL.createObjectURL.mock.calls[0];
        const csv = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(blob, 'utf-8');
        });
        const header = '日付,ユーザー,ソースの名前空間プレフィックス,アクション,セクション,代理ユーザー\n';
        const line = '"2026/11/18 09:00:00 JST","audit@example.invalid","sample","=原文,""引用""\n続き🧪","Apps","delegate@example.invalid"\n';
        expect(csv).toBe(header + line + line);
        expect(component.shadowRoot.querySelector('a[data-download]').download)
            .toBe('setup-audit-trail-' + monthStart.slice(0, 7) + '.csv');
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
    load.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce(page)
        .mockRejectedValueOnce({ status: 503 })
        .mockImplementationOnce(() => new Promise(() => {}));
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(button => button.label === 'CSV出力').click();
    await flush();

    expect(load).toHaveBeenCalledTimes(4);
    expect(load.mock.calls[2]).toEqual(load.mock.calls[3]);
    expect(load.mock.calls[3][0]).toEqual(expect.objectContaining({ nextId: 'cursor', nextTime: 'time' }));
    expect(component.shadowRoot.querySelector('[role="status"]').textContent)
        .toBe('CSVを作成中（1件取得済み）');
});

it('shows a CSV permission error without retrying', async () => {
    load.mockResolvedValueOnce({ records: [] })
        .mockRejectedValueOnce({ status: 403, body: { message: 'アクセス権限がありません。' } });
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(button => button.label === 'CSV出力').click();
    await flush();

    expect(load).toHaveBeenCalledTimes(2);
    expect(component.shadowRoot.querySelector('[role="alert"]').textContent)
        .toContain('アクセス権限がありません。');
});

it('stops fetching CSV pages when the component is removed', async () => {
    let finishPage;
    load.mockResolvedValueOnce({ records: [] }).mockImplementationOnce(() => new Promise(resolve => {
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
    expect(load).toHaveBeenCalledTimes(2);
});

it('reports how many CSV rows have been fetched while waiting for the next page', async () => {
    const row = { CreatedDate: '2026-11-18T00:00:00Z' };
    load.mockResolvedValueOnce({ records: [] })
        .mockResolvedValueOnce({ records: [row], nextId: 'cursor', nextTime: 'time' })
        .mockImplementationOnce(() => new Promise(() => {}));
    const component = mount();
    await flush();
    [...component.shadowRoot.querySelectorAll('lightning-button')]
        .find(child => child.label === 'CSV出力').click();
    await flush();
    expect(component.shadowRoot.querySelector('[role="status"]').textContent)
        .toBe('CSVを作成中（1件取得済み）');
});

it('keeps the current result when the normalized action filter is unchanged', async () => {
    load.mockResolvedValue({ records: [] });
    const component = mount();
    await flush();
    await chooseLookup(component, 'action', 'createdApexClass');
    await chooseLookup(component, 'action', 'createdApexClass');
    expect(load).toHaveBeenCalledTimes(1);
});


it('shows the monthly count and keeps it when a list filter changes', async () => {
    countMonth.mockResolvedValue(21638);
    load.mockResolvedValue({ records: [] });
    const component = mount();
    await flush();
    expect(component.shadowRoot.textContent).toContain('月（21,638件）');
    await chooseLookup(component, 'action', 'createdApexClass');
    await search(component);
    expect(countMonth).toHaveBeenCalledTimes(1);
    expect(countMatches).toHaveBeenCalledTimes(1);
    expect(countMatches).toHaveBeenCalledWith(expect.objectContaining({ action: 'createdApexClass' }));
    expect(component.shadowRoot.textContent).toContain('月（21,638件）');
});

it('moves through adjacent pages and resets the cursor only after search', async () => {
    countMonth.mockResolvedValue(4002);
    load.mockImplementation(({ nextId, action }) => {
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
    expect([...root.querySelectorAll('nav lightning-button')].map(item => item.label)).toEqual(['前へ', '次へ']);
    expect(button('前へ').disabled).toBe(true);
    expect(load.mock.calls[0][0]).toMatchObject({ pageSize: 2000, chart: false });
    button('次へ').click();
    await flush();
    expect(root.textContent).toContain('2 / 3ページ');
    expect(root.querySelector('lightning-datatable').rowNumberOffset).toBe(2000);
    button('次へ').click();
    await flush();
    expect(root.textContent).toContain('3 / 3ページ');
    expect(button('次へ').disabled).toBe(true);
    button('前へ').click();
    await flush();
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ nextId: 'cursor-2' }));

    await chooseLookup(component, 'action', 'createdApexClass');
    expect(root.textContent).toContain('2 / 3ページ');
    await search(component);
    expect(load.mock.calls.at(-1)[0]).not.toHaveProperty('nextId');
});

it('defers filtered result counts until the history tab is opened', async () => {
    load.mockImplementation(({ chart }) => Promise.resolve(chart ? { buckets: [] } : { records: [] }));
    const component = mount();
    await flush();
    const [historyTab, chartTab] = component.shadowRoot.querySelectorAll('lightning-tab');
    chartTab.dispatchEvent(new CustomEvent('active'));
    await flush();

    component.shadowRoot.querySelector('lightning-combobox[data-field="day"]')
        .dispatchEvent(new CustomEvent('change', { detail: { value: load.mock.calls[0][0].monthStart } }));
    await search(component);
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({
        chart: true, day: load.mock.calls[0][0].monthStart
    }));
    expect(countMatches).not.toHaveBeenCalled();

    historyTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(countMatches).toHaveBeenCalledTimes(1);
    chartTab.dispatchEvent(new CustomEvent('active'));
    historyTab.dispatchEvent(new CustomEvent('active'));
    await flush();
    expect(countMatches).toHaveBeenCalledTimes(1);
});

it('uses the same cutoff for every full history CSV page', async () => {
    load.mockResolvedValue({ records: [] });
    exportAllHistory.mockResolvedValueOnce({ records: [], nextId: 'cursor', nextTime: 'time' })
        .mockResolvedValueOnce({ records: [] });
    const component = mount();
    await flush();
    const menu = component.shadowRoot.querySelector('lightning-button-menu');
    expect(menu.querySelector('lightning-menu-item').label).toBe('CSV出力 (全期間)');
    menu.dispatchEvent(new CustomEvent('select', { detail: { value: 'all' } }));
    await flush();

    const cutoff = exportAllHistory.mock.calls[0][0].cutoff;
    expect(exportAllHistory.mock.calls).toEqual([
        [{ cutoff }],
        [{ cutoff, nextId: 'cursor', nextTime: 'time' }]
    ]);
    expect(load).toHaveBeenCalledTimes(1);
});

it('limits month navigation to the current month and the six preceding months', async () => {
    load.mockResolvedValue({ records: [] });
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
