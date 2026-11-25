import { createElement } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import UserCreateAssistant from 'c/userCreateAssistant';

afterEach(() => document.body.replaceChildren());

it('選択後に参照元を表示し、別の選択への応答を待つ間や解除後は以前の情報を隠す', async () => {
    const element = createElement('c-user-create-assistant', { is: UserCreateAssistant });
    document.body.appendChild(element);
    const root = element.shadowRoot;
    const picker = root.querySelector('lightning-record-picker');
    const select = async (recordId) => {
        picker.dispatchEvent(new CustomEvent('change', { detail: { recordId } }));
        await Promise.resolve();
    };
    expect(picker.objectApiName).toBe('User');
    await select('one');
    expect(root.querySelector('[role="status"]')).toBeTruthy();
    getRecord.emit({ id: 'one', fields: { Name: { value: '参照元A' } } });
    await Promise.resolve();
    expect(root.textContent).toContain('参照元A');
    await expect(element).toBeAccessible();
    await select('two');
    expect(root.textContent).not.toContain('参照元A');
    getRecord.error();
    await Promise.resolve();
    expect(root.querySelector('[role="alert"]')).toBeTruthy();
    await select(null);
    expect(root.querySelector('[role="alert"]')).toBeNull();
    await select('two');
    getRecord.emit({ id: 'two', fields: { Name: { value: '参照元B' } } });
    await Promise.resolve();
    expect(root.textContent).toContain('参照元B');
});
