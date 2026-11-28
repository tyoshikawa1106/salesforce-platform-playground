import { createElement } from 'lwc';
import OrgExplorerSearch from 'c/orgExplorerSearch';
const roles = [
    { targetId: 'accounting', label: '経理部' },
    { targetId: 'finance', label: '経理部 財務課' }
];
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};
function lookup() {
    const element = createElement('c-org-explorer-search', { is: OrgExplorerSearch });
    element.results = roles;
    element.searched = true;
    element.term = '経理';
    document.body.appendChild(element);
    return element;
}
afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});
it('候補を標準ルックアップのドロップダウンに表示してクリックで選択する', async () => {
    const element = lookup();
    expect(element.shadowRoot.querySelector('lightning-button')).toBeNull();
    expect(element.shadowRoot.querySelector('form')).toBeNull();
    expect(element.shadowRoot.querySelector('.slds-form-element__label')).toBeNull();
    expect(element.shadowRoot.querySelector('.slds-assistive-text').textContent).toBe('表示ロール');
    const picked = jest.fn();
    element.addEventListener('targetpick', picked);
    const input = element.shadowRoot.querySelector('input');
    input.focus();
    await flush();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(element.shadowRoot.querySelectorAll('[role="option"]')).toHaveLength(2);
    element.shadowRoot.querySelector('[data-id="finance"]').click();
    expect(picked.mock.calls[0][0].detail).toEqual({ targetId: 'finance' });
    await flush();
    expect(input.getAttribute('aria-expanded')).toBe('false');
});
it('上下キーとEnterで候補を一度だけ確定する', async () => {
    const element = lookup();
    const picked = jest.fn();
    element.addEventListener('targetpick', picked);
    const input = element.shadowRoot.querySelector('input');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    await flush();
    const activeId = input.getAttribute('aria-activedescendant');
    expect(element.shadowRoot.querySelector(`[id="${activeId}"]`).dataset.id).toBe('finance');
    await expect(element).toBeAccessible();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    await flush();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(picked.mock.calls[0][0].detail.targetId).toBe('accounting');
    expect(picked).toHaveBeenCalledTimes(1);
});
it('IME変換中のキー操作は候補に反映せず、変換後は選択できる', async () => {
    const element = lookup();
    const picked = jest.fn();
    element.addEventListener('targetpick', picked);
    const input = element.shadowRoot.querySelector('input');
    input.focus();
    await flush();
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
        const event = new KeyboardEvent('keydown', { key, isComposing: true, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    }
    await flush();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(picked).not.toHaveBeenCalled();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    await flush();
    const activeId = input.getAttribute('aria-activedescendant');
    expect(element.shadowRoot.querySelector(`[id="${activeId}"]`).dataset.id).toBe('accounting');
    const composingEnter = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
    input.dispatchEvent(composingEnter);
    await flush();
    expect(composingEnter.defaultPrevented).toBe(false);
    expect(picked).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-activedescendant')).toBe(activeId);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(picked).toHaveBeenCalledTimes(1);
    expect(picked.mock.calls[0][0].detail.targetId).toBe('accounting');
});
it('Escapeで候補を閉じて選択済みの起点を変更しない', async () => {
    const element = lookup();
    const picked = jest.fn();
    element.addEventListener('targetpick', picked);
    const input = element.shadowRoot.querySelector('input');
    input.focus();
    await flush();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await flush();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(element.shadowRoot.querySelector('[role="listbox"]')).toBeNull();
    expect(picked).not.toHaveBeenCalled();
    input.click();
    await flush();
    expect(input.getAttribute('aria-expanded')).toBe('true');
});
it('選択済みロールを幅いっぱいのSLDS入力とアイコンで表示し、解除後は候補とフォーカスを残さない', async () => {
    const element = createElement('c-org-explorer-search', { is: OrgExplorerSearch });
    element.selectedTarget = roles[0];
    const changed = jest.fn(() => {
        element.selectedTarget = null;
    });
    element.addEventListener('searchchange', changed);
    document.body.appendChild(element);
    await flush();
    const selected = element.shadowRoot.querySelector('input[readonly]');
    expect(selected.value).toBe('経理部');
    expect(selected.classList.contains('slds-input')).toBe(true);
    expect(element.shadowRoot.querySelector('.slds-combobox__input-entity-icon c-lookup-object-icon').objectApiName).toBe(
        'UserRole'
    );
    await expect(element).toBeAccessible();
    element.results = roles;
    selected.click();
    await flush();
    expect(element.shadowRoot.querySelector('[role="listbox"]')).not.toBeNull();
    const opened = jest.fn();
    element.addEventListener('lookupopen', opened);
    const clear = element.shadowRoot.querySelector('lightning-button-icon[title="選択を解除"]');
    clear.focus();
    clear.click();
    await flush();
    expect(changed.mock.calls[0][0].detail).toEqual({ value: '' });
    const input = element.shadowRoot.querySelector('input:not([readonly])');
    expect(element.shadowRoot.activeElement).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(element.shadowRoot.querySelector('[role="listbox"]')).toBeNull();
    expect(opened).not.toHaveBeenCalled();
    element.results = [...roles];
    await flush();
    expect(element.shadowRoot.querySelector('[role="listbox"]')).toBeNull();
    input.focus();
    await flush();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(element.shadowRoot.querySelector('[role="listbox"]')).not.toBeNull();
});
it('選択済みの欄をクリックしても解除せず、上位候補を要求する', async () => {
    const element = createElement('c-org-explorer-search', { is: OrgExplorerSearch });
    element.selectedTarget = roles[0];
    element.results = roles;
    const opened = jest.fn();
    element.addEventListener('lookupopen', opened);
    document.body.appendChild(element);
    const input = element.shadowRoot.querySelector('input[readonly]');
    input.click();
    await flush();
    expect(opened.mock.calls[0][0].detail).toEqual({ browse: true });
    expect(element.shadowRoot.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(input.value).toBe('経理部');
});
it.each(['ROLE', 'MANAGER'])('検索中の文言と空の候補枠を表示せず、取得後の空結果は案内する: %s', async (mode) => {
    const element = lookup();
    element.mode = mode;
    element.results = [];
    element.loading = true;
    element.shadowRoot.querySelector('input').focus();
    await flush();
    const status = element.shadowRoot.querySelector('[role="status"]');
    expect(status.textContent).toContain('検索中');
    expect(status.classList.contains('slds-assistive-text')).toBe(true);
    expect(element.shadowRoot.querySelector('.slds-dropdown')).toBeNull();
    expect(element.shadowRoot.querySelector('input').getAttribute('aria-expanded')).toBe('false');
    await expect(element).toBeAccessible();
    element.loading = false;
    await flush();
    expect(element.shadowRoot.querySelector('[role="status"]').textContent).toContain(
        mode === 'MANAGER' ? '一致する上司はありません' : '一致するロールはありません'
    );
    await expect(element).toBeAccessible();
});

it('上司候補はSLDSの補足行に部署と役職を表示し、補足なしの空行は作らない', async () => {
    const element = lookup();
    element.mode = 'MANAGER';
    element.results = [
        { targetId: 'boss', label: '試験 上司', description: '営業部 • 部長' },
        { targetId: 'empty', label: '試験 管理者', description: '' }
    ];
    element.shadowRoot.querySelector('input').focus();
    await flush();
    const options = element.shadowRoot.querySelectorAll('[role="option"]');
    expect(options[0].querySelector('.slds-listbox__option-text_entity').textContent).toBe('試験 上司');
    expect(options[0].querySelector('.slds-listbox__option-meta_entity').textContent).toBe('営業部 • 部長');
    expect(options[1].querySelector('.slds-listbox__option-meta')).toBeNull();
    await expect(element).toBeAccessible();
});

it.each(['ROLE', 'MANAGER'])('選択前後とも見えるラベルを設けず読み上げ名を維持する: %s', async (mode) => {
    const element = lookup();
    element.mode = mode;
    await flush();
    const label = element.shadowRoot.querySelector('.slds-assistive-text');
    expect(label.textContent).toBe(mode === 'MANAGER' ? '表示上司' : '表示ロール');
    expect(element.shadowRoot.querySelector('lightning-icon').alternativeText).toBe(
        mode === 'MANAGER' ? '上司検索' : 'ロール検索'
    );
    expect(element.shadowRoot.querySelector('.slds-form-element__label')).toBeNull();
    expect(element.shadowRoot.querySelector('input').getAttribute('aria-labelledby')).toBe(label.id);
    await expect(element).toBeAccessible();
    element.selectedTarget = roles[0];
    await flush();
    expect(element.shadowRoot.querySelector('input').getAttribute('aria-labelledby')).toBe(label.id);
    await expect(element).toBeAccessible();
});

it.each([
    ['ROLE', 'ロール名をさらに入力して候補を絞ってください。'],
    ['MANAGER', '氏名をさらに入力して候補を絞ってください。']
])('候補上限では対象に応じた入力案内を表示する: %s', async (mode, expected) => {
    const element = lookup();
    element.mode = mode;
    element.hasMore = true;
    element.results = [{ targetId: 'candidate', label: '試験候補' }];
    element.shadowRoot.querySelector('input').focus();
    await flush();
    expect(element.shadowRoot.querySelectorAll('[role="option"]')).toHaveLength(1);
    const message = element.shadowRoot.querySelector('.slds-dropdown [role="status"]');
    expect(message.textContent.trim()).toBe(expected);
    await expect(element).toBeAccessible();
});

it('選択済みのDeleteは解除通知を送り、IME変換中は維持する', async () => {
    const element = createElement('c-org-explorer-search', { is: OrgExplorerSearch });
    element.selectedTarget = roles[0];
    const changed = jest.fn();
    element.addEventListener('searchchange', changed);
    document.body.appendChild(element);
    const input = element.shadowRoot.querySelector('input[readonly]');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', isComposing: true }));
    expect(changed).not.toHaveBeenCalled();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
    expect(changed.mock.calls[0][0].detail).toEqual({ value: '' });
});
