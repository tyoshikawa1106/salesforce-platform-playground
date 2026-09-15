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
