import { createElement } from 'lwc';
import UserLocaleSettings from 'c/userLocaleSettings';
import getSettings from '@salesforce/apex/UserLocaleSettingsController.getSettings';
import saveSettings from '@salesforce/apex/UserLocaleSettingsController.saveSettings';

jest.mock('@salesforce/apex/UserLocaleSettingsController.getSettings', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/UserLocaleSettingsController.saveSettings', () => ({ default: jest.fn() }), { virtual: true });

const response = {
    language: 'ja', locale: 'en_GB', canEdit: true, errorMessage: '',
    languages: { fr: 'フランス語', ja: '日本語', en_US: '英語' },
    locales: { ja_JP: '日本', en_US: '米国', en_GB: '英国', fr_FR: 'フランス' }
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const button = (element, label) => [...element.shadowRoot.querySelectorAll('lightning-button')].find((item) => item.label === label);
const combo = (element, name) => [...element.shadowRoot.querySelectorAll('lightning-combobox')].find((item) => item.name === name) ?? null;
function change(element, name, value) {
    combo(element, name).dispatchEvent(new CustomEvent('change', { detail: { value } }));
}
function mount() {
    const element = createElement('c-user-locale-settings', { is: UserLocaleSettings });
    document.body.appendChild(element);
    return element;
}
async function edit() {
    const element = mount();
    await flush();
    button(element, '編集').click();
    await flush();
    return element;
}

describe('c-user-locale-settings', () => {
    let originalLocation;
    beforeEach(() => {
        getSettings.mockResolvedValue(response);
        saveSettings.mockResolvedValue({ language: 'en_US', locale: 'en_US', errorMessage: '' });
        originalLocation = window.location;
        delete window.location;
        window.location = { reload: jest.fn() };
    });
    afterEach(() => {
        document.body.replaceChildren();
        window.location = originalLocation;
        jest.resetAllMocks();
    });

    it('starts in accessible read mode and preserves the current combination', async () => {
        const element = mount();
        expect(button(element, '編集').disabled).toBe(true);
        await flush();
        expect(element.shadowRoot.textContent).toContain('日本語');
        expect(element.shadowRoot.textContent).toContain('英国');
        expect(combo(element, 'language')).toBeNull();
        await expect(element).toBeAccessible();
        button(element, '編集').click();
        await flush();
        expect(combo(element, 'locale').value).toBe('en_GB');
        expect(combo(element, 'language').options.map((option) => option.value)).toEqual(['ja', 'en_US', 'fr']);
        await expect(element).toBeAccessible();
    });

    it('links the locale on language changes and allows an override', async () => {
        const element = await edit();
        change(element, 'language', 'en_US');
        await flush();
        expect(combo(element, 'locale').value).toBe('en_US');
        change(element, 'locale', 'en_GB');
        change(element, 'language', 'en_US');
        await flush();
        expect(combo(element, 'locale').value).toBe('en_GB');
        change(element, 'language', 'fr');
        await flush();
        expect(combo(element, 'locale').value).toBe('fr_FR');
    });

    it('cancels without saving and restores both original values', async () => {
        const element = await edit();
        change(element, 'language', 'fr');
        button(element, 'キャンセル').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('日本語');
        expect(saveSettings).not.toHaveBeenCalled();
        button(element, '編集').click();
        await flush();
        expect(combo(element, 'language').value).toBe('ja');
        expect(combo(element, 'locale').value).toBe('en_GB');
    });

    it('saves both values once, freezes controls, and reloads on success', async () => {
        let resolveSave;
        saveSettings.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
        const element = await edit();
        change(element, 'language', 'en_US');
        button(element, '保存').click();
        button(element, '保存').click();
        change(element, 'language', 'fr');
        button(element, 'キャンセル').click();
        await flush();
        expect(saveSettings).toHaveBeenCalledTimes(1);
        expect(saveSettings).toHaveBeenCalledWith({ language: 'en_US', locale: 'en_US' });
        expect(combo(element, 'language').disabled).toBe(true);
        expect(combo(element, 'language').value).toBe('en_US');
        expect(button(element, 'キャンセル').disabled).toBe(true);
        resolveSave({ language: 'en_US', locale: 'en_US', errorMessage: '' });
        await flush();
        expect(window.location.reload).toHaveBeenCalledTimes(1);
        expect(combo(element, 'language')).toBeNull();
    });

    it('retains edits and shows a retryable server validation error', async () => {
        saveSettings.mockResolvedValueOnce({ errorMessage: '利用可能な地域を選択してください。' });
        const element = await edit();
        change(element, 'language', 'fr');
        button(element, '保存').click();
        await flush();
        expect(combo(element, 'language').value).toBe('fr');
        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('地域');
        expect(button(element, '保存').disabled).toBe(false);
        expect(window.location.reload).not.toHaveBeenCalled();
        await expect(element).toBeAccessible();
    });

    it('retains edits after transport failure and allows retry', async () => {
        saveSettings.mockRejectedValueOnce(new Error('private details'));
        const element = await edit();
        button(element, '保存').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('保存できませんでした');
        expect(element.shadowRoot.textContent).not.toContain('private details');
        expect(combo(element, 'locale').value).toBe('en_GB');
        button(element, '保存').click();
        await flush();
        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it('rejects missing automatic defaults until a valid locale is selected', async () => {
        getSettings.mockResolvedValueOnce({ ...response, languages: { ...response.languages, xx: '追加言語' } });
        const element = await edit();
        change(element, 'language', 'xx');
        await flush();
        expect(combo(element, 'locale').value).toBe('');
        button(element, '保存').click();
        await flush();
        expect(saveSettings).not.toHaveBeenCalled();
        expect(element.shadowRoot.textContent).toContain('地域を選択');
        change(element, 'locale', 'ja_JP');
        button(element, '保存').click();
        await flush();
        expect(saveSettings).toHaveBeenCalledWith({ language: 'xx', locale: 'ja_JP' });
    });

    it('does not expose editing without update permission', async () => {
        getSettings.mockResolvedValueOnce({ ...response, canEdit: false });
        const element = mount();
        await flush();
        expect(button(element, '編集').disabled).toBe(true);
        button(element, '編集').click();
        await flush();
        expect(combo(element, 'language')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('変更する権限がありません');
    });

    it.each(['transport', 'business'])('allows retry after a %s load failure', async (failure) => {
        if (failure === 'transport') getSettings.mockRejectedValueOnce(new Error('private'));
        else getSettings.mockResolvedValueOnce({ errorMessage: '設定を取得できませんでした。' });
        const element = mount();
        await flush();
        expect(button(element, '編集').disabled).toBe(true);
        button(element, '再読み込み').click();
        await flush();
        expect(button(element, '編集').disabled).toBe(false);
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    });

    it('discards a stale load response after reconnecting', async () => {
        let resolveLoad;
        getSettings.mockReturnValueOnce(new Promise((resolve) => { resolveLoad = resolve; }));
        const element = mount();
        element.remove();
        document.body.appendChild(element);
        await flush();
        resolveLoad({ ...response, language: 'fr' });
        await flush();
        expect(element.shadowRoot.textContent).toContain('日本語');
        expect(element.shadowRoot.textContent).not.toContain('フランス語');
    });

    it('does not reload the page when a detached save finishes', async () => {
        let resolveSave;
        saveSettings.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
        const element = await edit();
        button(element, '保存').click();
        element.remove();
        resolveSave({ language: 'en_US', locale: 'en_US', errorMessage: '' });
        await flush();
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it.each(['success', 'validation', 'transport'])('waits for a pending %s save before loading after reconnect', async (outcome) => {
        let resolveSave;
        let rejectSave;
        saveSettings.mockReturnValueOnce(new Promise((resolve, reject) => { resolveSave = resolve; rejectSave = reject; }));
        const element = await edit();
        change(element, 'language', 'en_US');
        button(element, '保存').click();
        element.remove();
        document.body.appendChild(element);
        await flush();
        expect(getSettings).toHaveBeenCalledTimes(1);
        expect(button(element, '編集').disabled).toBe(true);
        if (outcome === 'success') {
            getSettings.mockResolvedValueOnce({ ...response, language: 'en_US', locale: 'en_US' });
            resolveSave({ language: 'en_US', locale: 'en_US', errorMessage: '' });
        } else if (outcome === 'validation') {
            resolveSave({ errorMessage: '保存拒否' });
        } else {
            rejectSave(new Error('private'));
        }
        await flush();
        await flush();
        expect(getSettings).toHaveBeenCalledTimes(2);
        expect(element.shadowRoot.textContent).toContain(outcome === 'success' ? '英語' : '日本語');
        expect(button(element, '編集').disabled).toBe(false);
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(window.location.reload).not.toHaveBeenCalled();
        button(element, '編集').click();
        await flush();
        expect(combo(element, 'language').value).toBe(outcome === 'success' ? 'en_US' : 'ja');
        expect(combo(element, 'locale').value).toBe(outcome === 'success' ? 'en_US' : 'en_GB');
    });

    it('only loads for the latest connection when reconnecting repeatedly during a save', async () => {
        let resolveSave;
        saveSettings.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
        const element = await edit();
        button(element, '保存').click();
        element.remove();
        document.body.appendChild(element);
        element.remove();
        document.body.appendChild(element);
        await flush();
        expect(getSettings).toHaveBeenCalledTimes(1);
        resolveSave({ language: 'ja', locale: 'en_GB', errorMessage: '' });
        await flush();
        await flush();
        expect(getSettings).toHaveBeenCalledTimes(2);
        expect(button(element, '編集').disabled).toBe(false);
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('does not fetch while detached when a save awaited by a reconnect finishes', async () => {
        let resolveSave;
        saveSettings.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
        const element = await edit();
        button(element, '保存').click();
        element.remove();
        document.body.appendChild(element);
        element.remove();
        resolveSave({ language: 'ja', locale: 'en_GB', errorMessage: '' });
        await flush();
        expect(getSettings).toHaveBeenCalledTimes(1);
        expect(window.location.reload).not.toHaveBeenCalled();
        document.body.appendChild(element);
        await flush();
        expect(getSettings).toHaveBeenCalledTimes(2);
        expect(button(element, '編集').disabled).toBe(false);
    });

    it('distinguishes a reload failure from a failed save', async () => {
        window.location.reload.mockImplementationOnce(() => { throw new Error('reload'); });
        const element = await edit();
        button(element, '保存').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('保存しました。画面を再読み込み');
        expect(combo(element, 'language')).toBeNull();
    });
});
