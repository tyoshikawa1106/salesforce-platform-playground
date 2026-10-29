import { createElement } from 'lwc';
import AccountDeleteConfirm from 'c/accountDeleteConfirm';

describe('取引先削除の確認モーダル', () => {
    afterEach(() => document.body.replaceChildren());
    it.each([
        [0, false],
        [1, true]
    ])('ボタン%sから確認結果%sを返す', async (index, expected) => {
        const modal = createElement('c-account-delete-confirm', { is: AccountDeleteConfirm });
        const closeHandler = jest.fn();
        modal.closeHandler = closeHandler;
        document.body.appendChild(modal);
        modal.shadowRoot.querySelectorAll('lightning-button')[index].click();
        await Promise.resolve();
        expect(closeHandler).toHaveBeenCalledWith(expected);
        expect(modal.shadowRoot.textContent).toContain('法人・個人');
        await expect(modal).toBeAccessible();
    });
});


describe('モーダル内の例外表示', () => {
    afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });
    it('閉じる処理の失敗をモーダル内に表示する', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const modal = createElement('c-accountDeleteConfirm', { is: AccountDeleteConfirm });
        modal.closeHandler = () => { throw new TypeError('private-value'); };
        document.body.appendChild(modal);
        const cancel = [...modal.shadowRoot.querySelectorAll('lightning-button')].find((button) => button.label === 'キャンセル');
        cancel.click();
        await Promise.resolve();
        const panel = modal.shadowRoot.querySelector('c-ui-error-panel');
        expect(panel.details.location).toContain('accountDeleteConfirm.js / handleCancel');
        expect(panel.details.errorType).toBe('TypeError');
        await expect(modal).toBeAccessible();
    });
});
