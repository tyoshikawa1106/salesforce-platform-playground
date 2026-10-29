import { createElement } from 'lwc';
import ObjectRecordFormModal from 'c/objectRecordFormModal';


describe('モーダル内の例外表示', () => {
    afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });
    it('閉じる処理の失敗をモーダル内に表示する', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const modal = createElement('c-objectRecordFormModal', { is: ObjectRecordFormModal });
        modal.closeHandler = () => { throw new TypeError('private-value'); };
        document.body.appendChild(modal);
        const cancel = [...modal.shadowRoot.querySelectorAll('lightning-button')].find((button) => button.label === 'キャンセル');
        cancel.click();
        await Promise.resolve();
        const panel = modal.shadowRoot.querySelector('c-ui-error-panel');
        expect(panel.details.location).toContain('objectRecordFormModal.js / handleCancel');
        expect(panel.details.errorType).toBe('TypeError');
        await expect(modal).toBeAccessible();
    });
});

it('検証処理で例外になった場合はフォームの標準送信を止める', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const modal = createElement('c-object-record-form-modal', { is: ObjectRecordFormModal });
    modal.formSections = [{ key: 'one', headingId: 'one-heading', label: '基本', fields: [{ apiName: 'Name', required: true }] }];
    document.body.appendChild(modal);
    const form = modal.shadowRoot.querySelector('lightning-record-edit-form');
    const field = modal.shadowRoot.querySelector('lightning-input-field');
    field.reportValidity = jest.fn(() => { throw new TypeError('private'); });
    const submit = new CustomEvent('submit', { cancelable: true });
    form.dispatchEvent(submit);
    await Promise.resolve();
    expect(submit.defaultPrevented).toBe(true);
    expect(modal.shadowRoot.querySelector('c-ui-error-panel').details.location).toContain('handleSubmit');
    document.body.replaceChildren();
    jest.restoreAllMocks();
});
