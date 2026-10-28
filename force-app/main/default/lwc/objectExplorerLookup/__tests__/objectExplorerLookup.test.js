import { createElement } from 'lwc';
import ObjectExplorerLookup from 'c/objectExplorerLookup';

function createLookup() {
    const element = createElement('c-object-explorer-lookup', { is: ObjectExplorerLookup });
    document.body.appendChild(element);
    return element;
}
const flush = () => Promise.resolve();
afterEach(() => { document.body.replaceChildren(); });
it('検索と候補選択を値だけのイベントで親へ通知する', async () => {
    const element = createLookup();
    const change = jest.fn();
    const pick = jest.fn();
    element.addEventListener('searchchange', change);
    element.addEventListener('candidatepick', pick);
    const input = element.shadowRoot.querySelector('input');
    input.value = '取引先';
    input.dispatchEvent(new CustomEvent('input'));
    expect(change.mock.calls[0][0].detail).toEqual({ value: '取引先' });
    element.candidatesOpen = true;
    element.candidateView = { items: [{ value: 'Account', label: '取引先', domId: 'account-option', position: 1, total: 1, selected: true }], topStyle: '', bottomStyle: '' };
    element.activeObjectOptionId = 'account-option';
    await flush();
    element.shadowRoot.querySelector('[role="option"]').click();
    expect(pick.mock.calls[0][0].detail).toEqual({ apiName: 'Account' });
    await expect(element).toBeAccessible();
});
it('IME変換中は確定せず、キー移動にはDOMの座標だけを通知する', () => {
    const element = createLookup();
    const keys = jest.fn();
    element.addEventListener('searchkey', keys);
    const input = element.shadowRoot.querySelector('input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    expect(keys).not.toHaveBeenCalled();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    expect(keys.mock.calls[0][0].detail).toMatchObject({ key: 'ArrowDown' });
    expect(keys.mock.calls[0][0].detail).not.toHaveProperty('target');
});
it('選択済みでは検索せず、解除要求だけを親へ通知する', async () => {
    const element = createLookup();
    element.selected = { apiName: 'Account' };
    element.selectedLabel = '取引先';
    const clear = jest.fn();
    element.addEventListener('clear', clear);
    await flush();
    expect(element.shadowRoot.querySelector('input').readOnly).toBe(true);
    element.shadowRoot.querySelector('button').click();
    expect(clear).toHaveBeenCalledTimes(1);
    await expect(element).toBeAccessible();
});
