import { createElement } from 'lwc';
import OrgExplorerDetails from 'c/orgExplorerDetails';

const flush = () => Promise.resolve().then(() => Promise.resolve());
const mount = (values = {}) => {
    const element = createElement('c-org-explorer-details', { is: OrgExplorerDetails });
    Object.assign(element, values);
    document.body.appendChild(element);
    return element;
};
afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});
it('未選択ではロール名と表を出さず案内する', async () => {
    const element = mount();
    expect(element.shadowRoot.textContent).toContain('組織図からロールを選択してください。');
    expect(element.shadowRoot.querySelector('h2').textContent).toBe('メンバー');
    expect(element.shadowRoot.querySelector('c-org-explorer-datatable')).toBeNull();
    await expect(element).toBeAccessible();
});
it('見出しにロール名を括弧付きで表示し、切り替えで更新する', async () => {
    const element = mount({ targetLabel: '営業部' });
    const heading = element.shadowRoot.querySelector('h2');
    expect(heading.textContent).toBe('メンバー (営業部)');
    element.targetLabel = '経理部';
    await flush();
    expect(heading.textContent).toBe('メンバー (経理部)');
    await expect(element).toBeAccessible();
});
it('対象ゼロ件の案内でもロール名を維持する', () => {
    const element = mount({ targetLabel: '営業部', rows: [] });
    expect(element.shadowRoot.textContent).toContain('この条件で表示できるメンバーはいません。');
    expect(element.shadowRoot.querySelector('h2').textContent).toBe('メンバー (営業部)');
});
it('参照可能な列だけを読み取り専用の表へ渡す', async () => {
    const rows = [{ recordId: 'member-a', label: '利用者A', department: '営業部' }];
    const columns = [{ fieldName: 'label', label: '氏名', type: 'text' }];
    const element = mount({ targetLabel: '営業部', rows, columns });
    const table = element.shadowRoot.querySelector('c-org-explorer-datatable');
    expect(table.data).toEqual(rows);
    expect(table.columns).toEqual(columns);
    expect(table.hideCheckboxColumn).toBe(true);
    expect(table.showRowNumberColumn).toBe(true);
    expect(table.rowNumberOffset).toBe(0);
    expect(table.keyField).toBe('recordId');
    await expect(element).toBeAccessible();
});
it('取得中と失敗をゼロ件として表示しない', async () => {
    const element = mount({ targetLabel: '営業部', loading: true });
    expect(element.shadowRoot.querySelector('[role="status"]')).not.toBeNull();
    expect(element.shadowRoot.textContent).not.toContain('メンバーはいません');
    element.loading = false;
    element.error = '所属ユーザーを取得できませんでした。';
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toBe(element.error);
    expect(element.shadowRoot.textContent).not.toContain('メンバーはいません');
});

it('末尾の端数ページでも開始位置を標準行番号へ渡し、先頭復帰で戻す', async () => {
    const element = mount({ targetLabel: '営業担当', rows: [{ recordId: 'last' }], rowNumberOffset: 200 });
    const table = element.shadowRoot.querySelector('c-org-explorer-datatable');
    expect(table.rowNumberOffset).toBe(200);
    expect(table.showRowNumberColumn).toBe(true);
    element.rowNumberOffset = 0;
    await flush();
    expect(table.rowNumberOffset).toBe(0);
    await expect(element).toBeAccessible();
});

it('上司モードでは見出しと空一覧の案内をメンバーで統一する', async () => {
    const element = mount({ mode: 'MANAGER' });
    expect(element.shadowRoot.querySelector('h2').textContent).toBe('メンバー');
    expect(element.shadowRoot.textContent).toContain('組織図から上司を選択してください。');
    element.targetLabel = '利用者A';
    await flush();
    expect(element.shadowRoot.querySelector('h2').textContent).toBe('メンバー (利用者A)');
    expect(element.shadowRoot.textContent).toContain('この条件で表示できるメンバーはいません。');
    await expect(element).toBeAccessible();
});
