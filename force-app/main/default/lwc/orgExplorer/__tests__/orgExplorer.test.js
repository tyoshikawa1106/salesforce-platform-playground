import { createElement } from 'lwc';
import OrgExplorer from 'c/orgExplorer';
import getCapabilities from '@salesforce/apex/OrgExplorerController.getCapabilities';
import getPage from '@salesforce/apex/OrgExplorerController.getPage';
import searchRoles from '@salesforce/apex/OrgExplorerController.searchRoles';
import searchManagers from '@salesforce/apex/OrgExplorerController.searchManagers';
jest.mock('@salesforce/apex/OrgExplorerController.searchManagers', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/OrgExplorerController.getCapabilities', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/OrgExplorerController.getPage', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/OrgExplorerController.searchRoles', () => ({ default: jest.fn() }), { virtual: true });
const rolePages = jest.fn();
const managerPages = jest.fn();
const mockGenerateUrl = jest.fn();
jest.mock('lightning/navigation', () => {
    const GenerateUrl = Symbol('GenerateUrl');
    const NavigationMixin = (Base) =>
        class extends Base {
            [GenerateUrl](reference) {
                return mockGenerateUrl(reference);
            }
        };
    NavigationMixin.GenerateUrl = GenerateUrl;
    return { NavigationMixin };
});
const flush = () =>
    Array.from({ length: 25 }).reduce((chain) => chain.then(() => Promise.resolve()), Promise.resolve());
const user = {
    key: 'USER:self',
    recordId: 'self',
    kind: 'USER',
    label: '試験責任者',
    isActive: true,
    parentKey: '',
    titleState: 'EMPTY',
    departmentState: 'EMPTY'
};
const caps = {
    managerModeEnabled: true,
    roleModeEnabled: true,
    roleMembersEnabled: true,
    cardFieldLabels: { department: '所属組織', title: '職名', role: '割当ロール' }
};
const rootTarget = { key: 'ROLE:root', recordId: 'root', kind: 'ROLE', label: '本部', parentKey: '' };

async function openPendingManagerLookup() {
    let resolveStructure;
    let rejectStructure;
    managerPages.mockImplementationOnce(
        () =>
            new Promise((resolve, reject) => {
                resolveStructure = resolve;
                rejectStructure = reject;
            })
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-org-explorer-search');
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    return { element, lookup, resolveStructure, rejectStructure };
}
beforeEach(() => {
    getPage.mockImplementation((input) => (input.request.mode === 'MANAGER' ? managerPages(input) : rolePages(input)));
    mockGenerateUrl.mockImplementation((reference) => Promise.resolve(`/profile/${reference.attributes.recordId}`));
    getCapabilities.mockResolvedValue(caps);
    managerPages.mockResolvedValue({ nodes: [], hasMore: false });
    searchManagers.mockResolvedValue({ nodes: [], hasMore: false });
    rolePages.mockImplementation(({ request }) =>
        Promise.resolve({
            nodes:
                request.scope === 'ROLE_STRUCTURE'
                    ? [{ ...rootTarget, key: `ROLE:${request.parentId}`, recordId: request.parentId }]
                    : [],
            hasMore: false
        })
    );
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'root', label: '本部' }], hasMore: false });
});
afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
    jest.useRealTimers();
});
it('指定した起点から始め、無効ユーザーを初期表示に含め、チェック解除で有効だけに絞る', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(getCapabilities).toHaveBeenCalledWith({ request: expect.any(String) });
    expect(rolePages).toHaveBeenCalledWith({
        request: expect.objectContaining({ includeInactive: true, scope: 'ROLE_STRUCTURE', parentId: 'root' })
    });
    const toggle = element.shadowRoot.querySelector('[role="switch"]');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    await flush();
    expect(rolePages).toHaveBeenLastCalledWith({ request: expect.objectContaining({ includeInactive: false }) });
    expect(element.shadowRoot.querySelector('.c-controls button').dataset.mode).toBe('ROLE');
    expect(element.shadowRoot.querySelector('[data-mode="ROLE"]').getAttribute('aria-pressed')).toBe('true');
    const toolbar = element.shadowRoot.querySelector('.c-chart .c-toolbar');
    expect(toolbar.querySelector('[data-action="fit"]')).not.toBeNull();
    expect(toolbar.querySelector('.c-role-lookup c-org-explorer-search')).not.toBeNull();
    expect(element.shadowRoot.querySelector('main > .c-search')).toBeNull();
    expect(element.shadowRoot.querySelector('c-org-explorer-details').targetLabel).toBe('');
    await expect(element).toBeAccessible();
});
it('サーバー失敗を表示し、前の人物の詳細で補わない', async () => {
    getCapabilities.mockRejectedValue({ body: { message: '参照権限がありません。' } });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('参照権限');
    expect(element.shadowRoot.querySelector('c-org-explorer-details').targetLabel).toBe('');
    expect(rolePages).not.toHaveBeenCalled();
});
it('候補の選択で指定した部分木へ自動で表示を切り替える', async () => {
    jest.useFakeTimers();
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '営業' } }));
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'sales', label: '営業部' }], hasMore: false });
    jest.advanceTimersByTime(300);
    await flush();
    search.dispatchEvent(new CustomEvent('targetpick', { detail: { targetId: 'sales' } }));
    await flush();
    const rows = element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows;
    expect(rows.map((row) => row.key)).toEqual(['ROLE:sales']);
    expect(rows[0].depth).toBe(0);
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ scope: 'ROLE_STRUCTURE', parentId: 'sales' })
    });
    expect(rolePages.mock.calls.some(([input]) => input.request.scope === 'ROLE_ROOTS')).toBe(false);
});
it('表示条件変更前の遅延応答を反映しない', async () => {
    let resolveOld;
    rolePages.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveOld = resolve;
            })
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelector('.c-loading').parentElement).toBe(
        element.shadowRoot.querySelector('.c-chart')
    );
    expect(element.shadowRoot.querySelector('.c-loading .slds-assistive-text').textContent).toBe('読み込み中…');
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ mode: 'ROLE', scope: 'ROLE_STRUCTURE', includeInactive: false })
    });
    resolveOld({ hasMore: false, nodes: [{ ...user, label: '古い対象' }] });
    await flush();
    expect(
        element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows.some((row) => row.label === '古い対象')
    ).toBe(false);
});
it('表示条件を繰り返し変えても送信中のAPIは二つまでに抑える', async () => {
    let active = 0;
    let maximum = 0;
    const pending = [];
    rolePages.mockImplementation(({ request }) => {
        active += 1;
        maximum = Math.max(maximum, active);
        return new Promise((resolve) =>
            pending.push(() => {
                active -= 1;
                resolve(
                    request.scope === 'ROLE_STRUCTURE'
                        ? { nodes: [rootTarget], hasMore: false }
                        : { nodes: [], hasMore: false }
                );
            })
        );
    });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(pending).toHaveLength(2);
    expect(maximum).toBe(2);
    pending.shift()();
    await flush();
    expect(maximum).toBeLessThanOrEqual(2);
    pending.shift()();
    await flush();
    while (pending.length) pending.shift()();
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
});

it('トグル変更でも適用した起点を維持し、ロール候補を再検索しない', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(searchRoles).toHaveBeenCalledTimes(1);
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ parentId: 'root', includeInactive: false })
    });
    expect(element.shadowRoot.querySelector('[title="更新"]')).toBeNull();
});
it('取得中はスピナーを表示し、取得完了で消す', async () => {
    let resolvePage;
    rolePages.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolvePage = resolve;
            })
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelector('.c-spinner')).not.toBeNull();
    resolvePage({ nodes: [], hasMore: false });
    await flush();
    expect(element.shadowRoot.querySelector('.c-spinner')).toBeNull();
});
it('初期表示は全ロールだけを展開し、選択ロールのユーザーを前後ページで取得する', async () => {
    const root = { key: 'ROLE:root', recordId: 'root', kind: 'ROLE', label: '本部', parentKey: '' };
    const child = { key: 'ROLE:child', recordId: 'child', kind: 'ROLE', label: '営業部', parentKey: root.key };
    const first = { ...user, key: 'USER:first', recordId: 'first', parentKey: child.key };
    const second = { ...user, key: 'USER:second', recordId: 'second', parentKey: child.key };
    rolePages.mockImplementation(({ request }) => {
        let response = { nodes: [], hasMore: false };

        if (request.scope === 'ROLE_STRUCTURE') {
            response.nodes = [root, child];
            response.memberCounts = { child: 51 };
        }
        if (request.scope === 'ROLE_MEMBERS' && request.parentId === 'child') {
            response = request.startIndex
                ? { nodes: [second], hasMore: false, paginationCursor: { token: 'members' }, nextIndex: 52 }
                : { nodes: [first], hasMore: true, paginationCursor: { token: 'members' }, nextIndex: 51 };
            response.memberTotalCount = 51;
        }
        return Promise.resolve(response);
    });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await Array.from({ length: 10 }).reduce((chain) => chain.then(flush), Promise.resolve());
    expect(element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows.map((row) => row.key)).toEqual([
        root.key,
        child.key
    ]);
    expect(rolePages.mock.calls.some(([input]) => input.request.scope === 'ROLE_MEMBERS')).toBe(false);
    expect(element.shadowRoot.querySelector('.c-member-pages')).toBeNull();
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: child.key } }));
    await flush();
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rows[0].label).toContain(first.label);
    expect(element.shadowRoot.querySelector('.c-member-pages span').textContent).toBe('1 / 2');
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rowNumberOffset).toBe(0);
    element.shadowRoot.querySelector('[data-direction="next"]').click();
    await flush();
    expect(rolePages).toHaveBeenCalledWith({
        request: expect.objectContaining({
            scope: 'ROLE_MEMBERS',
            parentId: 'child',
            paginationCursor: { token: 'members' },
            startIndex: 51
        })
    });
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rows[0].label).toContain(second.label);
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rowNumberOffset).toBe(51);
    expect(element.shadowRoot.querySelector('.c-member-pages span').textContent).toBe('2 / 2');
    const countBeforeSameSelection = rolePages.mock.calls.length;
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: child.key } }));
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(countBeforeSameSelection);
    expect(element.shadowRoot.querySelector('.c-member-pages span').textContent).toBe('2 / 2');
    element.shadowRoot.querySelector('[data-direction="previous"]').click();
    await flush();
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({
            scope: 'ROLE_MEMBERS',
            parentId: 'child',
            startIndex: 0,
            paginationCursor: { token: 'members' }
        })
    });
    expect(element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows).toHaveLength(2);
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rowNumberOffset).toBe(0);
    expect(element.shadowRoot.querySelector('.c-spinner')).toBeNull();
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: root.key } }));
    await flush();
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rows).toEqual([]);
    expect(element.shadowRoot.querySelector('.c-member-pages')).toBeNull();
    expect(element.shadowRoot.querySelector('[data-direction]')).toBeNull();
    await expect(element).toBeAccessible();
});

it('200件を超えるロールも表示モデルから除外しない', async () => {
    const roots = Array.from({ length: 251 }, (_, index) => ({
        key: `ROLE:r${index}`,
        recordId: `r${index}`,
        kind: 'ROLE',
        label: `部門${index}`,
        parentKey: 'ROLE:root'
    }));
    rolePages.mockImplementation(({ request }) => {
        if (request.scope !== 'ROLE_STRUCTURE') return Promise.resolve({ nodes: [], hasMore: false });
        const start = Number(request.cursor || 0);
        const end = Math.min(roots.length, start + 1000);
        return Promise.resolve({
            nodes: [rootTarget, ...roots.slice(start, end)],
            hasMore: end < roots.length,
            nextCursor: end < roots.length ? String(end) : ''
        });
    });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await Array.from({ length: 100 }).reduce((chain) => chain.then(flush), Promise.resolve());
    expect(element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows).toHaveLength(252);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
});
it.each(['', '   ', null, undefined])('初期ロール設定が空なら照会せず全ロールを表示する: %s', async (setting) => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    element.defaultRootRoleApiName = setting;
    document.body.appendChild(element);
    await flush();
    expect(searchRoles).not.toHaveBeenCalled();
    expect(rolePages).toHaveBeenCalledWith({
        request: expect.objectContaining({ parentId: null, scope: 'ROLE_STRUCTURE' })
    });
    expect(element.shadowRoot.querySelector('c-org-explorer-search').selectedTarget).toBeNull();
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    await expect(element).toBeAccessible();
});
it('初期ロールが見つからなければ空欄で全ロールを表示し、再取得でも初期値を再照会しない', async () => {
    searchRoles.mockResolvedValue({ nodes: [], hasMore: false });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(rolePages).toHaveBeenCalledWith({ request: expect.objectContaining({ parentId: null }) });
    expect(element.shadowRoot.querySelector('c-org-explorer-search').selectedTarget).toBeNull();
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(searchRoles).toHaveBeenCalledTimes(1);
});
it('初期ロールはAPI名の前後空白を除いて解決する', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    element.defaultRootRoleApiName = '  ExampleCompany  ';
    document.body.appendChild(element);
    await flush();
    expect(searchRoles).toHaveBeenCalledWith({
        request: expect.objectContaining({ developerName: 'ExampleCompany', term: '' })
    });
    expect(rolePages).toHaveBeenCalledWith({ request: expect.objectContaining({ parentId: 'root' }) });
});
it('初期ロールの照会失敗では全ロール取得へ進まずエラーを表示する', async () => {
    searchRoles.mockRejectedValue({ body: { message: '初期ロールの照会に失敗しました。' } });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(rolePages).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('照会に失敗');
});
it('廃止した操作を表示せず、等倍ボタンをキャンバスへ接続する', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(
        [...element.shadowRoot.querySelectorAll('.c-zoom button')].map((button) => button.textContent.trim())
    ).toEqual(['－', '＋', '100%', '全体を表示']);
    const text = element.shadowRoot.textContent;
    for (const label of ['自分を表示', 'ルート一覧', '前の対象へ', '次の対象へ']) expect(text).not.toContain(label);
    for (const action of ['left', 'right', 'up', 'down'])
        expect(element.shadowRoot.querySelector(`[data-action="${action}"]`)).toBeNull();
    const canvas = element.shadowRoot.querySelector('c-org-explorer-canvas');
    const reset = jest.spyOn(canvas, 'resetZoom');
    element.shadowRoot.querySelector('[data-action="reset"]').click();
    expect(reset).toHaveBeenCalledTimes(1);
});
it('未確定の名称では表示を切り替えず、選択必須エラーを出さない', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(searchRoles).toHaveBeenCalledWith({
        request: expect.objectContaining({ developerName: 'SampleCompany', term: '' })
    });
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    const calls = rolePages.mock.calls.length;
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '営業' } }));
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(calls);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
});
it('入力変更後に完了した旧ロール候補を表示しない', async () => {
    jest.useFakeTimers();
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    let resolveOld;
    searchRoles.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveOld = resolve;
            })
    );
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '営業' } }));
    jest.advanceTimersByTime(300);
    await flush();
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '経理' } }));
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'accounting', label: '経理部' }], hasMore: false });
    jest.advanceTimersByTime(300);
    await flush();
    resolveOld({ nodes: [{ recordId: 'sales', label: '営業部' }], hasMore: false });
    await flush();
    expect(search.results.map((item) => item.targetId)).toEqual(['accounting']);
    expect(search.loading).toBe(false);
});
it('候補選択後に起点が参照できなくなった場合は配下を取得しない', async () => {
    rolePages.mockRejectedValue({ body: { message: '対象を表示できません。' } });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows).toHaveLength(0);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('対象を表示できません');
});
it('表示条件変更時に前の候補上限の案内を残さない', async () => {
    jest.useFakeTimers();
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'sales', label: '営業部' }], hasMore: true });
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '営業' } }));
    jest.advanceTimersByTime(300);
    await flush();
    expect(search.hasMore).toBe(true);
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(search.hasMore).toBe(false);
    expect(search.results).toEqual([]);
});
it('未入力で開くと最上位の候補だけを一回取得する', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    searchRoles.mockResolvedValue({
        nodes: [
            { recordId: 'company', label: '会社' },
            { recordId: 'ceo', label: 'CEO' }
        ],
        hasMore: false
    });
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    search.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await Array.from({ length: 5 }).reduce((chain) => chain.then(flush), Promise.resolve());
    expect(search.results).toHaveLength(2);
    expect(search.results.slice(0, 2).map((item) => item.targetId)).toEqual(['company', 'ceo']);
    expect(searchRoles).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ term: '' })
    });
    expect(searchRoles).toHaveBeenCalledTimes(2);
});
it('一文字目から前方一致で候補を取得する', async () => {
    jest.useFakeTimers();
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'sales', label: '営業部' }], hasMore: false });
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '営' } }));
    jest.advanceTimersByTime(300);
    await flush();
    expect(searchRoles).toHaveBeenLastCalledWith({ request: expect.objectContaining({ term: '営' }) });
    expect(search.results[0].targetId).toBe('sales');
});

it('100段のロール構造を一回で取得し、再展開でも通信しない', async () => {
    const chain = Array.from({ length: 100 }, (_, i) => ({
        ...rootTarget,
        key: `ROLE:chain${i}`,
        recordId: `chain${i}`,
        label: `階層${i}`,
        parentKey: i === 0 ? '' : `ROLE:chain${i - 1}`
    }));
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'chain0', label: '階層0' }], hasMore: false });
    rolePages.mockResolvedValue({ nodes: chain, memberCounts: { chain0: 8 }, hasMore: false });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const outline = element.shadowRoot.querySelector('c-org-explorer-canvas');
    expect(outline.model.rows).toHaveLength(100);
    expect(outline.model.rows[0].memberCountText).toBe('メンバー 8人');
    expect(rolePages).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('c-org-explorer-outline')).toBeNull();
});
it('1000件境界を自動取得し、後のページにある起点へ接続して別の枝を除外する', async () => {
    let finish;
    const children = Array.from({ length: 1000 }, (_, i) => ({
        ...rootTarget,
        key: `ROLE:bulk${i}`,
        recordId: `bulk${i}`,
        parentKey: 'ROLE:root'
    }));
    rolePages
        .mockResolvedValueOnce({ nodes: children, hasMore: true, nextCursor: 'structure-next' })
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows).toHaveLength(0);
    finish({ nodes: [rootTarget, { ...rootTarget, key: 'ROLE:outside', recordId: 'outside' }], hasMore: false });
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(2);
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ scope: 'ROLE_STRUCTURE', cursor: 'structure-next' })
    });
    const rows = element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows;
    expect(rows).toHaveLength(1001);
    expect(rows.some((row) => row.key === 'ROLE:outside')).toBe(false);
});
it('不正な構造カーソルを繰り返し取得しない', async () => {
    rolePages.mockResolvedValue({ nodes: [rootTarget], hasMore: true, nextCursor: 'repeat' });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(2);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('取得位置が不正');
});

it('上司構造の不正な継続位置をロールと案内しない', async () => {
    managerPages.mockResolvedValue({ nodes: [user], hasMore: true, nextCursor: 'repeat' });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
    await flush();
    expect(managerPages).toHaveBeenCalledTimes(2);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('階層構造の続きの取得位置が不正');
});

it.each(['ROLE', 'MANAGER'])('選択した表示対象が構造に存在しなければモードに合う案内を表示する: %s', async (mode) => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    if (mode === 'MANAGER') {
        element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
        await flush();
        searchManagers.mockResolvedValue({ nodes: [user], hasMore: false });
    } else {
        rolePages.mockResolvedValue({ nodes: [], hasMore: false });
    }
    const lookup = element.shadowRoot.querySelector('c-org-explorer-search');
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: mode === 'ROLE' } }));
    if (mode === 'MANAGER') {
        // 未入力候補ではなく氏名検索から選択した上司が取得時に消えた場合を再現する。
        lookup.term = '試験';
        lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '試験' } }));
        lookup.dispatchEvent(new CustomEvent('lookupopen'));
    }
    await flush();
    lookup.dispatchEvent(new CustomEvent('targetpick', { detail: { targetId: mode === 'ROLE' ? 'root' : 'self' } }));
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain(
        mode === 'MANAGER' ? '指定した上司を表示できません' : '指定したロールを表示できません'
    );
    await expect(element).toBeAccessible();
});

it('空の起点で全ロールをページ取得し、表示条件変更でも全体検索を維持する', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const other = { ...rootTarget, key: 'ROLE:other', recordId: 'other', label: '別会社', parentKey: '' };
    const child = { ...rootTarget, key: 'ROLE:child', recordId: 'child', label: '部門', parentKey: rootTarget.key };
    rolePages.mockImplementation(({ request }) =>
        Promise.resolve({
            nodes: request.cursor ? [other, child] : [rootTarget],
            hasMore: !request.cursor,
            nextCursor: request.cursor ? '' : 'all-next'
        })
    );
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '  ' } }));
    await flush();
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ scope: 'ROLE_STRUCTURE', parentId: null, cursor: 'all-next' })
    });
    const rows = element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows;
    expect(rows.map((row) => row.key)).toEqual(expect.arrayContaining([rootTarget.key, other.key, child.key]));
    expect(rows.find((row) => row.key === other.key).depth).toBe(0);
    expect(rows.find((row) => row.key === child.key).depth).toBe(1);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ parentId: null, includeInactive: false })
    });
});

it('候補選択の直後に解除した場合、遅れて届いた選択範囲で全体表示を上書きしない', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const search = element.shadowRoot.querySelector('c-org-explorer-search');
    searchRoles.mockResolvedValue({ nodes: [{ recordId: 'sales', label: '営業部' }], hasMore: false });
    search.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    let resolveSelected;
    const other = { ...rootTarget, key: 'ROLE:other', recordId: 'other', label: '別会社' };
    rolePages.mockImplementation(({ request }) => {
        if (request.parentId === 'sales') {
            return new Promise((resolve) => {
                resolveSelected = resolve;
            });
        }
        return Promise.resolve({ nodes: [rootTarget, other], hasMore: false });
    });
    search.dispatchEvent(new CustomEvent('targetpick', { detail: { targetId: 'sales' } }));
    await flush();
    expect(resolveSelected).toBeDefined();
    search.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '' } }));
    await flush();
    const currentKeys = () =>
        element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows.map((row) => row.key);
    expect(currentKeys()).toEqual([rootTarget.key, other.key]);
    resolveSelected({ nodes: [{ ...rootTarget, key: 'ROLE:sales', recordId: 'sales' }], hasMore: false });
    await flush();
    expect(currentKeys()).toEqual([rootTarget.key, other.key]);
    expect(search.selectedTarget).toBeNull();
});

it('上司に切り替えて構造とメンバーを取得しロールの起点を復元する', async () => {
    const manager = { ...user, recordId: 'boss', key: 'USER:boss', label: '営業統括', title: '部長', titleState: 'VALUE' };
    const child = { ...user, recordId: 'child-manager', key: 'USER:child-manager', parentKey: manager.key };
    managerPages.mockImplementation(({ request }) =>
        Promise.resolve(
            request.scope === 'MANAGER_STRUCTURE'
                ? {
                      nodes: [manager, child],
                      memberCounts: { boss: 12, 'child-manager': 3 },
                      hasMore: false
                  }
                : {
                      nodes: [{ ...user, profileName: '標準ユーザー', roleName: '営業担当' }],
                      memberColumns: ['label', 'profileName', 'roleName'],
                      memberColumnLabels: { label: '氏名' },
                      hasMore: false
                  }
        )
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
    await flush();
    const canvas = element.shadowRoot.querySelector('c-org-explorer-canvas');
    expect(canvas.model.rows).toHaveLength(2);
    expect(canvas.model.rows[0].memberCountText).toBe('メンバー 12人');
    expect(canvas.model.rows[0].departmentLabel).toBe('所属組織');
    expect(canvas.model.rows[0].titleLabel).toBe('職名');
    expect(canvas.model.rows[0].roleLabel).toBe('割当ロール');
    expect(element.shadowRoot.querySelector('[data-mode="MANAGER"]').getAttribute('aria-pressed')).toBe('true');
    canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: manager.key } }));
    await flush();
    expect(managerPages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ scope: 'MANAGER_MEMBERS', parentId: 'boss', mode: 'MANAGER' })
    });
    expect(getPage).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ scope: 'MANAGER_MEMBERS', parentId: 'boss', mode: 'MANAGER' })
    });
    expect(element.shadowRoot.querySelector('c-org-explorer-details').mode).toBe('MANAGER');
    expect(element.shadowRoot.querySelector('c-org-explorer-details').targetLabel).toBe('営業統括・部長');
    const details = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(details.rows).toHaveLength(1);
    expect(details.rows[0].roleName).toBe('営業担当');
    expect(details.columns.map((column) => column.fieldName)).toEqual(['userUrl', 'profileName', 'roleName']);
    expect(details.columns[2].type).toBe('text');
    expect(details.columns[2].label).toBe('ロール');
    element.shadowRoot.querySelector('[data-mode="ROLE"]').click();
    await flush();
    expect(element.shadowRoot.querySelector('c-org-explorer-search').selectedTarget.targetId).toBe('root');
    expect(details.rows).toEqual([]);
    expect(details.columns).toEqual([]);
    await expect(element).toBeAccessible();
});
it.each([
    ['ROLE', 203, 1, false, '1 / 1'],
    ['ROLE', 1, 203, true, '1 / 5'],
    ['MANAGER', 203, 1, false, '1 / 1'],
    ['MANAGER', 1, 203, true, '1 / 5']
])(
    '構造の人数が古くても一覧カーソルの件数で総ページ数を表示する: %s, %i → %i',
    async (mode, structureCount, totalCount, hasMore, label) => {
        const target = mode === 'ROLE' ? rootTarget : { ...user, key: 'USER:boss', recordId: 'boss' };
        const action = mode === 'ROLE' ? rolePages : managerPages;
        action.mockImplementation(({ request }) =>
            Promise.resolve(
                request.scope.endsWith('_STRUCTURE')
                    ? { nodes: [target], memberCounts: { [target.recordId]: structureCount } }
                    : { nodes: [user], memberTotalCount: totalCount, hasMore, nextIndex: hasMore ? 50 : 0 }
            )
        );
        const element = createElement('c-org-explorer', { is: OrgExplorer });
        document.body.appendChild(element);
        await flush();
        if (mode === 'MANAGER') {
            element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
            await flush();
        }
        element.shadowRoot
            .querySelector('c-org-explorer-canvas')
            .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: target.key } }));
        await flush();
        expect(element.shadowRoot.querySelector('.c-member-pages span').textContent).toBe(label);
        expect(element.shadowRoot.querySelector('[data-direction="next"]').disabled).toBe(!hasMore);
        await expect(element).toBeAccessible();
    }
);

it('上司参照権限がない場合は上司階層への切り替えを無効にする', async () => {
    getCapabilities.mockResolvedValue({ ...caps, managerModeEnabled: false });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(element.shadowRoot.querySelector('[data-mode="MANAGER"]').disabled).toBe(true);
    expect(managerPages).not.toHaveBeenCalled();
});
it('ロールの参照権限がなくても上司階層へ自動で切り替えない', async () => {
    getCapabilities.mockResolvedValue({ ...caps, roleModeEnabled: false });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    expect(rolePages).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('参照権限');
});

it('所属一覧の古い応答で選択ロール名とユーザーを上書きしない', async () => {
    const other = { ...rootTarget, key: 'ROLE:other', recordId: 'other', parentKey: rootTarget.key, label: '経理部' };
    let resolveOld;
    rolePages.mockImplementation(({ request }) => {
        if (request.scope === 'ROLE_STRUCTURE') return Promise.resolve({ nodes: [rootTarget, other] });
        if (request.parentId === 'root')
            return new Promise((resolve) => {
                resolveOld = resolve;
            });
        return Promise.resolve({
            nodes: [{ ...user, label: '現在のユーザー' }],
            memberColumns: ['label'],
            memberColumnLabels: { label: '氏名' }
        });
    });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const canvas = element.shadowRoot.querySelector('c-org-explorer-canvas');
    canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    await flush();
    canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: other.key } }));
    await flush();
    resolveOld({
        nodes: [{ ...user, label: '古いユーザー' }],
        memberColumns: ['label', 'email'],
        memberColumnLabels: { label: '古い氏名', email: '古いメール' }
    });
    await flush();
    const list = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(list.targetLabel).toBe('経理部');
    expect(list.rows[0].label).toBe('現在のユーザー');
    expect(list.columns.map((column) => column.fieldName)).toEqual(['userUrl']);
    expect(list.columns[0].label).toBe('氏名');
});
it('所属一覧取得の失敗をユーザーゼロ件と区別する', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    rolePages.mockRejectedValue({ body: { message: '所属ユーザーを参照できません。' } });
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    await flush();
    const list = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(list.error).toBeTruthy();
    expect(list.loading).toBe(false);
    expect(list.rows).toEqual([]);
    expect(list.targetLabel).toBe(rootTarget.label);
});

it('氏名と上司を標準Userページへ対応させ、同じ上司のURLを重複生成しない', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    rolePages.mockResolvedValue({
        nodes: [
            { ...user, managerId: 'manager', managerName: '上司' },
            { ...user, recordId: 'other', managerId: 'manager', managerName: '上司' }
        ],
        memberColumns: ['label', 'managerName'],
        memberColumnLabels: { label: '利用者氏名', managerName: '直属上司' }
    });
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    await flush();
    expect(mockGenerateUrl).toHaveBeenCalledTimes(3);
    expect(mockGenerateUrl).toHaveBeenCalledWith({
        type: 'standard__recordPage',
        attributes: { recordId: 'manager', objectApiName: 'User', actionName: 'view' }
    });
    const list = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(list.rows[0].userUrl).toBe('/profile/self');
    expect(list.rows[0].managerUrl).toBe('/profile/manager');
    expect(list.rows[1].managerUrl).toBe('/profile/manager');
    expect(list.columns.every((column) => column.typeAttributes.target === '_blank')).toBe(true);
    expect(list.columns.map((column) => column.label)).toEqual(['利用者氏名', 'マネージャー']);
});
it.each(['ROLE', 'MANAGER'])('URL生成に失敗した場合は取得中を終了して対象共通の案内を表示する: %s', async (mode) => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    if (mode === 'MANAGER') {
        managerPages.mockResolvedValue({ nodes: [user], hasMore: false });
        element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
        await flush();
    }
    rolePages.mockResolvedValue({
        nodes: [user],
        memberColumns: ['label'],
        memberColumnLabels: { label: '氏名' }
    });
    mockGenerateUrl.mockRejectedValue(new Error('内部エラー情報'));
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: mode === 'ROLE' ? rootTarget.key : user.key } }));
    await flush();
    const list = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(list.error).toBe('メンバーのリンクを生成できませんでした。対象を選択し直してください。');
    expect(list.error).not.toContain('内部エラー情報');
    expect(list.loading).toBe(false);
    expect(list.rows).toEqual([]);
});

it('リンク生成を待つ間に別ロールへ移った場合は古い一覧を表示しない', async () => {
    const child = { ...rootTarget, key: 'ROLE:child', recordId: 'child', parentKey: rootTarget.key, label: '別部署' };
    rolePages.mockImplementation(({ request }) =>
        Promise.resolve({
            nodes: request.scope === 'ROLE_STRUCTURE' ? [rootTarget, child] : [{ ...user, recordId: request.parentId }],
            memberColumns: ['label'],
            memberColumnLabels: { label: '氏名' }
        })
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    let finishOld;
    mockGenerateUrl.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finishOld = resolve;
            })
    );
    const canvas = element.shadowRoot.querySelector('c-org-explorer-canvas');
    canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    await flush();
    canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: child.key } }));
    await flush();
    finishOld('/profile/root');
    await flush();
    const list = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(list.targetLabel).toBe('別部署');
    expect(list.rows[0].userUrl).toBe('/profile/child');
    expect(list.loading).toBe(false);
});

it('同じ画面要素を再接続した後も構造を取得し直して操作できる', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const calls = rolePages.mock.calls.length;
    element.remove();
    document.body.appendChild(element);
    await flush();
    expect(rolePages.mock.calls.length).toBeGreaterThan(calls);
    expect(element.shadowRoot.querySelector('c-org-explorer-canvas').model.rows).not.toHaveLength(0);
    expect(element.shadowRoot.querySelector('[role="status"]')).toBeNull();
});

it('上司の未入力候補は全ページの上位20人を通信せず表示し、氏名入力時だけ検索する', async () => {
    jest.useFakeTimers();
    const boss = {
        ...user,
        key: 'USER:boss',
        recordId: 'boss',
        label: '本社',
        parentKey: '',
        department: '本社部門',
        departmentState: 'VALUE',
        title: '代表',
        titleState: 'VALUE'
    };
    const children = Array.from({ length: 22 }, (_, i) => ({
        ...user,
        key: `USER:child${i}`,
        recordId: `child${i}`,
        label: `部門${String(i).padStart(2, '0')}`,
        parentKey: boss.key
    }));
    managerPages.mockImplementation(({ request }) =>
        Promise.resolve({
            nodes: request.cursor ? [boss] : children,
            hasMore: !request.cursor,
            nextCursor: request.cursor ? '' : 'manager-next'
        })
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector('[data-mode="MANAGER"]').click();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-org-explorer-search');
    expect(lookup.selectedTarget).toBeNull();
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    expect(lookup.results).toHaveLength(20);
    expect(lookup.results[0]).toEqual({ targetId: 'boss', label: '本社', description: '本社部門 • 代表' });
    expect(lookup.hasMore).toBe(true);
    expect(searchManagers).not.toHaveBeenCalled();
    expect(managerPages).toHaveBeenCalledTimes(2);
    lookup.dispatchEvent(new CustomEvent('targetpick', { detail: { targetId: 'child0' } }));
    await flush();
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    expect(lookup.results[0].targetId).toBe('boss');
    expect(searchManagers).not.toHaveBeenCalled();
    managerPages.mockResolvedValue({ nodes: [boss, children[0]], hasMore: false });
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    expect(lookup.results.map((item) => item.targetId)).toEqual(['boss', 'child0']);
    expect(lookup.hasMore).toBe(false);
    expect(searchManagers).not.toHaveBeenCalled();
    searchManagers.mockResolvedValue({ nodes: [{ ...boss, label: '部門長' }], hasMore: false });
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '部' } }));
    await jest.advanceTimersByTimeAsync(300);
    await flush();
    expect(searchManagers).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ term: '部', activityFilter: 'ACTIVE' })
    });
    expect(lookup.results[0].description).toBe('本社部門 • 代表');
    jest.useRealTimers();
    await expect(element).toBeAccessible();
});

it('読み込み中に開いた未入力候補は全構造の取得完了後に表示する', async () => {
    const { element, lookup, resolveStructure } = await openPendingManagerLookup();
    expect(lookup.loading).toBe(true);
    expect(lookup.searched).toBe(false);
    expect(lookup.results).toEqual([]);
    let resolveNext;
    managerPages.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveNext = resolve;
            })
    );
    const boss = { ...user, key: 'USER:boss', recordId: 'boss', label: '上位上司' };
    const child = { ...user, parentKey: boss.key };
    resolveStructure({ nodes: [child], hasMore: true, nextCursor: 'next' });
    await flush();
    expect(lookup.loading).toBe(true);
    expect(lookup.searched).toBe(false);
    expect(lookup.results).toEqual([]);
    resolveNext({ nodes: [boss], hasMore: false });
    await flush();
    expect(lookup.loading).toBe(false);
    expect(lookup.searched).toBe(true);
    expect(lookup.results.map((hit) => hit.targetId)).toEqual(['boss', user.recordId]);
    expect(managerPages).toHaveBeenCalledTimes(2);
    expect(searchManagers).not.toHaveBeenCalled();
    await expect(element).toBeAccessible();
});

it('構造待機中に氏名を入力したら後着の未入力候補で検索結果を上書きしない', async () => {
    jest.useFakeTimers();
    const { lookup, resolveStructure } = await openPendingManagerLookup();
    searchManagers.mockResolvedValue({ nodes: [{ ...user, label: '検索対象' }], hasMore: false });
    lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '検索' } }));
    await jest.advanceTimersByTimeAsync(300);
    await flush();
    expect(lookup.results.map((hit) => hit.label)).toEqual(['検索対象']);
    resolveStructure({ nodes: [{ ...user, label: '上位候補' }], hasMore: false });
    await flush();
    expect(lookup.results.map((hit) => hit.label)).toEqual(['検索対象']);
    expect(lookup.loading).toBe(false);
    expect(searchManagers).toHaveBeenCalledTimes(1);
});

it.each(['mode', 'clear', 'inactive'])('構造待機中の%s操作で古い候補を破棄する', async (action) => {
    const { element, lookup, resolveStructure } = await openPendingManagerLookup();
    if (action === 'mode') element.shadowRoot.querySelector('[data-mode="ROLE"]').click();
    else if (action === 'clear') lookup.dispatchEvent(new CustomEvent('searchchange', { detail: { value: '' } }));
    else element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    resolveStructure({ nodes: [{ ...user, label: '古い上司' }], hasMore: false });
    await flush();
    expect(lookup.results).toEqual([]);
    expect(lookup.searched).toBe(false);
    expect(lookup.loading).toBe(false);
    expect(searchManagers).not.toHaveBeenCalled();
});

it('構造取得失敗を候補なしと誤表示せず検索中状態を終了する', async () => {
    const { element, lookup, rejectStructure } = await openPendingManagerLookup();
    rejectStructure({ body: { message: '構造を取得できません。' } });
    await flush();
    expect(lookup.results).toEqual([]);
    expect(lookup.searched).toBe(false);
    expect(lookup.loading).toBe(false);
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('構造を取得できません');
});

it('構造取得が成功して上司がゼロ件の場合だけ候補なしを確定する', async () => {
    const { lookup, resolveStructure } = await openPendingManagerLookup();
    resolveStructure({ nodes: [], hasMore: false });
    await flush();
    expect(lookup.results).toEqual([]);
    expect(lookup.searched).toBe(true);
    expect(lookup.loading).toBe(false);
});

it('カード選択と所属一覧のページ移動で配置済みの接続線と座標を再計算しない', async () => {
    const child = { ...rootTarget, key: 'ROLE:child', recordId: 'child', label: '部門', parentKey: rootTarget.key };
    rolePages.mockImplementation(({ request }) =>
        Promise.resolve(
            request.scope === 'ROLE_STRUCTURE'
                ? { nodes: [rootTarget, child], hasMore: false }
                : { nodes: [user], hasMore: true, paginationCursor: { token: 'direct' }, nextIndex: 50 }
        )
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const canvas = element.shadowRoot.querySelector('c-org-explorer-canvas');
    const before = canvas.model;
    canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: child.key } }));
    await flush();
    expect(canvas.model.edges).toBe(before.edges);
    expect(canvas.model.rows.map((row) => row.style)).toEqual(before.rows.map((row) => row.style));
    expect(canvas.model.rows.find((row) => row.key === child.key).selected).toBe(true);
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rows).toHaveLength(1);
    expect(rolePages.mock.calls.filter(([{ request }]) => request.scope === 'ROLE_STRUCTURE')).toHaveLength(1);
    element.shadowRoot.querySelector('[data-direction="next"]').click();
    await flush();
    expect(canvas.model.edges).toBe(before.edges);
    await expect(element).toBeAccessible();
});

it('同じカードの取得中クリックは照会を増やさず、失敗後の再選択で復旧する', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    let complete;
    rolePages.mockImplementation(
        () =>
            new Promise((resolve, reject) => {
                complete = reject;
            })
    );
    const canvas = element.shadowRoot.querySelector('c-org-explorer-canvas');
    const select = () => canvas.dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    select();
    await flush();
    const count = rolePages.mock.calls.length;
    select();
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(count);
    complete({ body: { message: '所属一覧の一時的な失敗' } });
    await flush();
    const details = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(details.error).toContain('一時的な失敗');
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    rolePages.mockResolvedValue({ nodes: [user], memberColumns: ['label'], hasMore: false });
    select();
    await flush();
    expect(rolePages).toHaveBeenCalledTimes(count + 1);
    expect(details.error).toBe('');
    expect(details.rows).toHaveLength(1);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
});

it.each([
    ['ROLE', 'response'],
    ['ROLE', 'network'],
    ['MANAGER', 'response'],
    ['MANAGER', 'network']
])('%s候補の再検索が%sで失敗したら旧候補を破棄し、成功時に復旧する', async (mode, failure) => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    element.defaultRootRoleApiName = '';
    document.body.appendChild(element);
    await flush();
    element.shadowRoot.querySelector(`[data-mode="${mode}"]`).click();
    await flush();
    const lookup = element.shadowRoot.querySelector('c-org-explorer-search');
    const input = lookup.shadowRoot.querySelector('input');
    const search = mode === 'ROLE' ? searchRoles : searchManagers;
    search.mockResolvedValueOnce({ nodes: [{ recordId: 'previous', label: '候補A' }], hasMore: true });
    input.value = '候補';
    input.dispatchEvent(new CustomEvent('input'));
    input.click();
    await flush();
    expect(lookup.shadowRoot.querySelector('[data-id="previous"]')).not.toBeNull();
    expect(lookup.hasMore).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    if (failure === 'network') search.mockRejectedValueOnce(new Error('一時的な通信エラー'));
    else search.mockRejectedValueOnce({ body: { message: '参照権限なし' } });
    input.click();
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain(
        failure === 'network' ? '通信に失敗' : '参照権限なし'
    );
    expect(lookup.results).toEqual([]);
    expect(lookup.hasMore).toBe(false);
    expect(lookup.searched).toBe(false);
    expect(lookup.loading).toBe(false);
    expect(lookup.shadowRoot.querySelector('[role="listbox"]')).toBeNull();
    const pageCalls = getPage.mock.calls.length;
    lookup.dispatchEvent(new CustomEvent('targetpick', { detail: { targetId: 'previous' } }));
    await flush();
    expect(getPage).toHaveBeenCalledTimes(pageCalls);
    search.mockResolvedValueOnce({ nodes: [{ recordId: 'current', label: '候補B' }], hasMore: false });
    input.click();
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    expect(lookup.results.map((hit) => hit.targetId)).toEqual(['current']);
    expect(lookup.shadowRoot.querySelector('[data-id="current"]')).not.toBeNull();
    expect(lookup.loading).toBe(false);
    await expect(element).toBeAccessible();
});

it('前の入力の失敗が遅れて届いても新しい入力の候補を破棄しない', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    element.defaultRootRoleApiName = '';
    document.body.appendChild(element);
    await flush();
    const lookup = element.shadowRoot.querySelector('c-org-explorer-search');
    const input = lookup.shadowRoot.querySelector('input');
    let rejectPrevious;
    searchRoles.mockImplementationOnce(
        () =>
            new Promise((resolve, reject) => {
                rejectPrevious = reject;
            })
    );
    input.value = '前';
    input.dispatchEvent(new CustomEvent('input'));
    input.click();
    await flush();
    searchRoles.mockResolvedValueOnce({ nodes: [{ recordId: 'current', label: '新候補' }], hasMore: true });
    input.value = '新';
    input.dispatchEvent(new CustomEvent('input'));
    input.click();
    await flush();
    rejectPrevious(new Error('古い要求の通信エラー'));
    await flush();
    expect(lookup.results.map((hit) => hit.targetId)).toEqual(['current']);
    expect(lookup.hasMore).toBe(true);
    expect(lookup.searched).toBe(true);
    expect(lookup.loading).toBe(false);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
});

it('候補検索が成功しても構造取得の失敗は消さない', async () => {
    rolePages.mockRejectedValue({ body: { message: '構造取得に失敗' } });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const lookup = element.shadowRoot.querySelector('c-org-explorer-search');
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('構造取得に失敗');
    searchRoles.mockRejectedValueOnce({ body: { message: '候補取得に失敗' } });
    lookup.dispatchEvent(new CustomEvent('lookupopen', { detail: { browse: true } }));
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('構造取得に失敗');
});

it('標準カーソル失効時は古い一覧を消し、同じカードの再選択で先頭から取得し直す', async () => {
    const cursor = { token: 'standard-members' };
    rolePages.mockImplementation(({ request }) => {
        if (request.scope === 'ROLE_STRUCTURE') return Promise.resolve({ nodes: [rootTarget] });
        if (request.startIndex > 0)
            return Promise.reject({ body: { message: 'ページを再取得してください。' } });
        return Promise.resolve({ nodes: [user], paginationCursor: cursor, nextIndex: 53, hasMore: true });
    });
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    const select = () =>
        element.shadowRoot
            .querySelector('c-org-explorer-canvas')
            .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    select();
    await flush();
    element.shadowRoot.querySelector('[data-direction="next"]').click();
    await flush();
    const details = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(details.rows).toEqual([]);
    expect(details.error).toContain('再取得');
    expect(element.shadowRoot.querySelector('.c-member-pages')).toBeNull();
    select();
    await flush();
    expect(rolePages).toHaveBeenLastCalledWith({
        request: expect.objectContaining({ scope: 'ROLE_MEMBERS', startIndex: 0, paginationCursor: null })
    });
    expect(details.rows).toHaveLength(1);
    expect(details.error).toBe('');
    await expect(element).toBeAccessible();
});

it('標準カーソルの上限案内は成功した一覧だけに表示し、条件変更で破棄する', async () => {
    rolePages.mockImplementation(({ request }) =>
        Promise.resolve(
            request.scope === 'ROLE_STRUCTURE'
                ? { nodes: [rootTarget] }
                : {
                      nodes: [user],
                      hasMore: false,
                      paginationCursor: { token: 'limited' },
                      memberNotice: '一覧は最大100,000件まで表示します。'
                  }
        )
    );
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    element.shadowRoot
        .querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    await flush();
    expect(element.shadowRoot.querySelector('.c-panel > p[role="status"]').textContent).toContain('100,000件');
    element.shadowRoot.querySelector('[role="switch"]').click();
    await flush();
    expect(element.shadowRoot.querySelector('.c-panel > p[role="status"]')).toBeNull();
    expect(element.shadowRoot.querySelector('c-org-explorer-details').rows).toEqual([]);
});


it('所属一覧の通信失敗をリンク生成失敗と誤表示せず、内部情報も公開しない', async () => {
    const element = createElement('c-org-explorer', { is: OrgExplorer });
    document.body.appendChild(element);
    await flush();
    rolePages.mockRejectedValueOnce(new Error('内部の通信詳細'));
    element.shadowRoot.querySelector('c-org-explorer-canvas')
        .dispatchEvent(new CustomEvent('nodeselect', { detail: { key: rootTarget.key } }));
    await flush();
    const details = element.shadowRoot.querySelector('c-org-explorer-details');
    expect(details.error).toContain('所属ユーザーを取得できませんでした');
    expect(details.error).not.toContain('リンク');
    expect(details.error).not.toContain('内部の通信詳細');
    expect(details.rows).toEqual([]);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    await expect(element).toBeAccessible();
});


describe('処理場所付きエラー表示', () => {
    afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });
    it('失敗した取得元を表示し、診断を閉じても画面を維持する', async () => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        getCapabilities.mockRejectedValueOnce(new Error('private-value'));
        const element = createElement('c-orgExplorer', { is: OrgExplorer });
        document.body.appendChild(element);
        await Promise.resolve();

        await Array.from({ length: 35 }).reduce((pending) => pending.then(() => Promise.resolve()), Promise.resolve());
        const panel = element.shadowRoot.querySelector('c-ui-error-panel');
        expect(panel.details.location).toContain('orgExplorer.js / loadContext');
        expect(JSON.stringify(log.mock.calls)).not.toContain('private-value');
        panel.dispatchEvent(new CustomEvent('dismiss'));
        await Promise.resolve();
        expect(panel.details).toBeUndefined();
        expect(element.isConnected).toBe(true);
        await expect(element).toBeAccessible();
    });
});

it('子の描画例外を親の境界で受け止め、画面内へ表示する', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        const element = createElement('c-org-explorer', { is: OrgExplorer });
        document.body.appendChild(element);
        await flush();
        element.shadowRoot.querySelector('c-org-explorer-canvas').model = null;
        await flush();
        const details = element.shadowRoot.querySelector('c-ui-error-panel').details;
        expect(details.location).toBe('orgExplorer.js / 描画データの検証 / model-validation');
        expect(details.code).toBe('ORG-JS-MODEL');
        expect(details.reason).toContain('rowsは配列');
        expect(details.errorType).toBe('TypeError');
        expect(element.shadowRoot.querySelector('h1')).not.toBeNull();
    } finally { log.mockRestore(); }
});
it('子のフレーム失敗通知は固定の処理名で安全に表示する', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        const element = createElement('c-org-explorer', { is: OrgExplorer });
        document.body.appendChild(element);
        await flush();
        element.shadowRoot.querySelector('c-org-explorer-canvas').dispatchEvent(new CustomEvent('clienterror', { detail: { errorType: 'TypeError', frames: ['https://private.example/orgExplorerCanvas.js:10:3'] } }));
        await flush();
        expect(element.shadowRoot.querySelector('c-ui-error-panel').details.location).toContain('orgExplorerCanvas.handlePointerMove');
        expect(JSON.stringify(log.mock.calls)).not.toContain('private.example');
    } finally { log.mockRestore(); }
});

it('子のドラッグ開始エラーを移動描画エラーへ置き換えず処理名を表示する', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        const element = createElement('c-org-explorer', { is: OrgExplorer });
        document.body.appendChild(element);
        await flush();
        element.shadowRoot.querySelector('c-org-explorer-canvas').dispatchEvent(new CustomEvent('clienterror', {
            detail: { location: 'orgExplorerCanvas.js / handlePointerDown / pointer-event', errorType: 'TypeError', frames: [] }
        }));
        await flush();
        expect(element.shadowRoot.querySelector('c-ui-error-panel').details.location).toBe('orgExplorer.js / ドラッグ開始 / pointer-event');
        await expect(element).toBeAccessible();
    } finally { log.mockRestore(); }
});
