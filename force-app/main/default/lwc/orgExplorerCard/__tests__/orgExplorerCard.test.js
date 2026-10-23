import { createElement } from 'lwc';
import OrgExplorerCard from 'c/orgExplorerCard';
import { buildView, createStructureGraph } from '../../orgExplorer/orgExplorerLogic';

const graphFor = (node) => createStructureGraph({ [node.key]: node });
const role = { key: 'ROLE:root', recordId: 'root', kind: 'ROLE', label: '営業部', memberCount: 12 };
afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});
it('カードのポインタ選択はスクロールせずフォーカスし、クリックを一度だけ通知する', async () => {
    const element = createElement('c-org-explorer-card', { is: OrgExplorerCard });
    element.node = buildView(graphFor(role), 'ROLE').rows[0];
    document.body.appendChild(element);
    const select = jest.fn();
    element.addEventListener('nodeselect', select);
    const button = element.shadowRoot.querySelector('button');
    const focus = jest.spyOn(button, 'focus');
    const down = new CustomEvent('pointerdown', { bubbles: true, cancelable: true });
    Object.assign(down, { button: 0, isPrimary: true });
    button.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(select).not.toHaveBeenCalled();
    button.click();
    expect(select).toHaveBeenCalledTimes(1);
    expect(select.mock.calls[0][0].detail).toEqual({ key: role.key });
    await expect(element).toBeAccessible();
});
it('右クリックと副ポインタではフォーカスを移動しない', () => {
    const element = createElement('c-org-explorer-card', { is: OrgExplorerCard });
    element.node = buildView(graphFor(role), 'ROLE').rows[0];
    document.body.appendChild(element);
    const button = element.shadowRoot.querySelector('button');
    const focus = jest.spyOn(button, 'focus');
    for (const values of [
        { button: 2, isPrimary: true },
        { button: 0, isPrimary: false }
    ]) {
        const down = new CustomEvent('pointerdown', { bubbles: true, cancelable: true });
        Object.assign(down, values);
        button.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(false);
    }
    expect(focus).not.toHaveBeenCalled();
});
it('ロールカードは選択と人数だけを表示し、Spaceで子を展開しない', async () => {
    const element = createElement('c-org-explorer-card', { is: OrgExplorerCard });
    element.node = buildView(graphFor(role), 'ROLE').rows[0];
    const select = jest.fn();
    const expand = jest.fn();
    element.addEventListener('nodeselect', select);
    element.addEventListener('scopeexpand', expand);
    document.body.appendChild(element);
    expect(element.shadowRoot.querySelectorAll('button')).toHaveLength(1);
    expect(element.shadowRoot.querySelector('.c-actions')).toBeNull();
    expect(element.shadowRoot.textContent).toContain('メンバー 12人');
    expect(element.shadowRoot.textContent).not.toContain('表示中');
    const button = element.shadowRoot.querySelector('button');
    const space = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    button.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    expect(expand).not.toHaveBeenCalled();
    button.click();
    expect(select.mock.calls[0][0].detail).toEqual({ key: role.key });
    element.node = buildView({ ...graphFor(role), selectedKey: role.key }, 'ROLE').rows[0];
    await Promise.resolve();
    expect(element.shadowRoot.textContent).not.toContain('選択中');
    expect(element.shadowRoot.querySelector('article').classList.contains('c-selected')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await expect(element).toBeAccessible();
    element.node = buildView(graphFor(role), 'ROLE').rows[0];
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('article').classList.contains('c-selected')).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
});
it('上司カードに参照できる部署・役職・ロールを表示し、非参照項目は表示しない', async () => {
    const node = {
        key: 'USER:manager',
        recordId: 'manager',
        kind: 'USER',
        label: '試験上司',
        isActive: true,
        managerCard: true,
        memberCount: 3,
        department: '営業部',
        departmentState: 'VALUE',
        title: '営業部長',
        titleState: 'VALUE',
        role: { name: '営業ロール', state: 'VALUE' }
    };
    const element = createElement('c-org-explorer-card', { is: OrgExplorerCard });
    element.node = buildView(graphFor(node), 'MANAGER', { department: '所属組織', title: '職名', role: '割当ロール' }).rows[0];
    document.body.appendChild(element);
    expect(element.shadowRoot.textContent).toContain('所属組織：営業部');
    expect(element.shadowRoot.textContent).toContain('職名：営業部長');
    expect(element.shadowRoot.textContent).toContain('割当ロール：営業ロール');
    expect(element.shadowRoot.textContent).toContain('メンバー 3人');
    expect(element.shadowRoot.querySelectorAll('button')).toHaveLength(1);
    await expect(element).toBeAccessible();
    element.node = buildView(
        graphFor({
            ...node,
            departmentState: 'UNAVAILABLE',
            titleState: 'UNAVAILABLE',
            role: { name: '', state: 'UNAVAILABLE' }
        }),
        'MANAGER',
        { department: '所属組織', title: '職名', role: '割当ロール' }
    ).rows[0];
    await Promise.resolve();
    expect(element.shadowRoot.textContent).not.toContain('所属組織：');
    expect(element.shadowRoot.textContent).not.toContain('職名：');
    expect(element.shadowRoot.textContent).not.toContain('割当ロール：');
    expect(element.shadowRoot.textContent).toContain('メンバー 3人');
});
