import { createElement } from 'lwc';
import OrgExplorerHierarchyModal from 'c/orgExplorerHierarchyModal';

afterEach(() => document.body.replaceChildren());
it('標準ヘッダーへロール名を渡し、重複ラベルなしで多数の直下行を表示する', async () => {
    const modal = createElement('c-org-explorer-hierarchy-modal', { is: OrgExplorerHierarchyModal });
    modal.label = '本部';
    modal.hierarchy = { listLabel: '下位ロール', hasChildren: true, children: Array.from({ length: 50 }, (_, i) => ({ key: `role${i}`, label: `支部${i}`, selectLabel: `支部${i}を選択`, summary: `メンバー ${i}人 ｜ 下位ロール 0件` })) };
    const closeHandler = jest.fn();
    modal.closeHandler = closeHandler;
    document.body.appendChild(modal);
    expect(modal.shadowRoot.querySelector('lightning-modal-header').label).toBe('本部');
    expect(modal.shadowRoot.textContent).not.toContain('選択中のロール');
    expect(modal.shadowRoot.querySelectorAll('li')).toHaveLength(50);
    expect(modal.shadowRoot.querySelector('li').textContent).toContain('メンバー 0人 ｜ 下位ロール 0件');
    modal.shadowRoot.querySelector('[data-key="role49"]').click();
    expect(closeHandler).toHaveBeenCalledWith('role49');
    await expect(modal).toBeAccessible();
});
it('末端ロールを空状態で表示し、閉じる操作では選択結果を返さない', () => {
    const modal = createElement('c-org-explorer-hierarchy-modal', { is: OrgExplorerHierarchyModal });
    modal.label = '末端';
    modal.hierarchy = { listLabel: '下位ロール', emptyMessage: '直下の下位ロールはありません。', hasChildren: false, children: [] };
    modal.closeHandler = jest.fn();
    document.body.appendChild(modal);
    expect(modal.shadowRoot.textContent).toContain('直下の下位ロールはありません。');
    modal.shadowRoot.querySelector('lightning-modal-footer lightning-button').click();
    expect(modal.closeHandler).toHaveBeenCalledWith(undefined);
});
