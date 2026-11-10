import { createElement } from 'lwc';
import ExternalClientAppCredentialModal from 'c/externalClientAppCredentialModal';
import { matchesApplicationId } from '../externalClientAppCredentialModalLogic';

const expectedId = '0xI000000000001EAA';
afterEach(() => document.body.replaceChildren());
it('15桁と18桁を照合し、異なるIDやチェックサムを拒否する', () => {
    expect(matchesApplicationId('0xI000000000001', expectedId)).toBe(true);
    expect(matchesApplicationId(` ${expectedId} `, expectedId)).toBe(true);
    for (const id of ['', 'wrong', '0xI000000000001AAA', '0xI000000000002']) {
        expect(matchesApplicationId(id, expectedId)).toBe(false);
    }
});
it('不一致は入力欄に表示して閉じず、修正後だけ閉じる', async () => {
    const modal = createElement('c-external-client-app-credential-modal', { is: ExternalClientAppCredentialModal });
    modal.expectedId = expectedId;
    modal.applicationLabel = '対象';
    modal.closeHandler = jest.fn();
    document.body.appendChild(modal);
    const input = modal.shadowRoot.querySelector('lightning-input');
    input.setCustomValidity = jest.fn();
    input.reportValidity = jest.fn();
    const submit = [...modal.shadowRoot.querySelectorAll('lightning-button')].find((item) => item.label === '適用');
    input.value = 'wrong';
    input.dispatchEvent(new CustomEvent('change'));
    submit.click();
    expect(input.setCustomValidity).toHaveBeenLastCalledWith(expect.stringContaining('一致する15桁または18桁'));
    expect(input.reportValidity).toHaveBeenCalled();
    expect(modal.closeHandler).not.toHaveBeenCalled();
    input.value = expectedId;
    input.dispatchEvent(new CustomEvent('change'));
    submit.click();
    expect(modal.closeHandler).toHaveBeenCalledWith(expectedId);
    await expect(modal).toBeAccessible();
});
