import { createElement } from 'lwc';
import { setImmediate } from 'timers';
import LightningConfirm from 'lightning/confirm';
import ExternalClientAppCredentialModal from 'c/externalClientAppCredentialModal';
import ExternalClientAppManager from 'c/externalClientAppManager';
import execute from '@salesforce/apex/ExternalClientAppManagerController.execute';
import getAuthentication from '@salesforce/apex/ExternalClientAppManagerController.getAuthentication';
import getAuthenticationUrl from '@salesforce/apex/ExternalClientAppManagerController.getAuthenticationUrl';

jest.mock('@salesforce/apex/ExternalClientAppManagerController.execute', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/ExternalClientAppManagerController.getAuthentication', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/ExternalClientAppManagerController.getAuthenticationUrl', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/ExternalClientAppManagerController.revokeAuthentication', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('lightning/confirm', () => ({ __esModule: true, default: { open: jest.fn() } }), { virtual: true });
jest.mock('c/externalClientAppCredentialModal', () => ({ __esModule: true, default: { open: jest.fn() } }), {
    virtual: true
});
const apps = [{ id: '0xI000000000001', label: '対象', name: 'Target' }];
const stage = { id: 'new', state: 'active' };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const button = (element, label = '適用') =>
    [...element.shadowRoot.querySelectorAll('lightning-button')].find((item) => item.label === label);
const actions = () => execute.mock.calls.map(([r]) => r.input.action);
async function createComponent(authentication = { status: 'AUTHENTICATED' }) {
    getAuthentication.mockResolvedValue(authentication);
    getAuthenticationUrl.mockResolvedValue('/auth');
    ExternalClientAppCredentialModal.open.mockResolvedValue(apps[0].id);
    execute.mockResolvedValue({ stages: [] }).mockResolvedValueOnce({ applications: apps });
    const element = createElement('c-external-client-app-manager', { is: ExternalClientAppManager });
    document.body.appendChild(element);
    await flush();
    return element;
}
async function select(element) {
    element.shadowRoot.querySelector('input[role="combobox"]').click();
    await flush();
    element.shadowRoot.querySelector('[role="option"]').click();
    await flush();
    execute.mockClear();
}
function updateResponses() {
    execute
        .mockResolvedValueOnce({ stages: [] })
        .mockResolvedValueOnce({ state: 'complete', stages: [stage] })
        .mockResolvedValueOnce({ state: 'complete', stages: [{ ...stage, state: 'rotated' }] });
}
describe('外部クライアントアプリ認証管理', () => {
    afterEach(() => {
        document.body.replaceChildren();
        jest.resetAllMocks();
    });
    it('入力時は取得済み候補の外もサーバーで再検索して選択できる', async () => {
        const element = await createComponent();
        const input = element.shadowRoot.querySelector('input[role="combobox"]');
        const candidates = Array.from({ length: 2 }, (_, index) => ({ id: `app${index}`, label: `候補${index}`, name: `App${index}` }));
        execute.mockResolvedValueOnce({ applications: candidates });
        input.value = 'App';
        input.dispatchEvent(new CustomEvent('input'));
        await flush();
        expect(element.shadowRoot.querySelectorAll('[role="option"]')).toHaveLength(2);
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        const outside = { id: 'outside', label: '別の対象', name: 'Outside' };
        execute.mockResolvedValueOnce({ applications: [outside] });
        input.value = 'Outside';
        input.dispatchEvent(new CustomEvent('input'));
        await flush();
        expect(execute).toHaveBeenLastCalledWith({ input: { action: 'list', term: 'Outside' } });
        expect(element.shadowRoot.querySelectorAll('[role="option"]')).toHaveLength(1);
        expect(element.shadowRoot.querySelector('[role="option"]').textContent).toContain('別の対象');
        expect(element.shadowRoot.querySelector('[role="option"]').textContent).toContain('Outside');
        await expect(element).toBeAccessible();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        await flush();
        expect(input.getAttribute('aria-activedescendant')).toBe(element.shadowRoot.querySelector('[role="option"]').id);
        execute.mockResolvedValueOnce({ stages: [] });
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        await flush();
        expect(execute).toHaveBeenLastCalledWith({ input: expect.objectContaining({ action: 'stages', appId: 'outside', confirmation: 'Outside' }) });
        expect(element.shadowRoot.querySelector('input[role="combobox"]')).toBeNull();
        expect(element.shadowRoot.querySelector('.slds-pill_container .slds-pill__label').textContent).toBe('別の対象');
        expect(element.shadowRoot.activeElement).toBe(element.shadowRoot.querySelector('.slds-pill__remove'));
        await expect(element).toBeAccessible();
        execute.mockResolvedValueOnce({ applications: [outside] }).mockResolvedValueOnce({ stages: [] });
        element.remove();
        document.body.appendChild(element);
        await flush();
        expect(execute.mock.calls.at(-2)[0]).toEqual({ input: { action: 'list', appId: 'outside' } });
        expect(element.shadowRoot.querySelector('.slds-pill__label').textContent).toBe('別の対象');
    });
    it.each([['検索完了後', false], ['検索中', true]])('%sに再接続しても入力語に一致する候補を再取得する', async (_, pending) => {
        const element = await createComponent();
        const outside = { id: 'outside', label: '別の対象', name: 'Outside' };
        let resolvePrevious;
        execute.mockImplementation(({ input }) => Promise.resolve({
            applications: input.term === 'Outside' ? [outside] : apps
        }));
        if (pending) {
            execute.mockReturnValueOnce(new Promise((resolve) => { resolvePrevious = resolve; }));
        }
        const input = element.shadowRoot.querySelector('input[role="combobox"]');
        input.value = 'Outside';
        input.dispatchEvent(new CustomEvent('input'));
        await flush();
        element.remove();
        document.body.appendChild(element);
        await flush();
        expect(execute).toHaveBeenLastCalledWith({ input: { action: 'list', term: 'Outside' } });
        const restoredInput = element.shadowRoot.querySelector('input[role="combobox"]');
        expect(restoredInput.value).toBe('Outside');
        restoredInput.click();
        await flush();
        if (pending) {
            resolvePrevious({ applications: apps });
            await flush();
        }
        const options = element.shadowRoot.querySelectorAll('[role="option"]');
        expect(options).toHaveLength(1);
        expect(options[0].textContent).toContain('Outside');
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        await expect(element).toBeAccessible();
    });
    it('古い検索の成功や失敗は新しい候補を上書きしない', async () => {
        const element = await createComponent();
        const input = element.shadowRoot.querySelector('input[role="combobox"]');
        let resolveFirst;
        let rejectSecond;
        execute.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
            .mockReturnValueOnce(new Promise((_, reject) => { rejectSecond = reject; }))
            .mockResolvedValueOnce({ applications: [{ ...apps[0], label: '最新候補' }] });
        for (const term of ['a', 'ab', 'abc']) {
            input.value = term;
            input.dispatchEvent(new CustomEvent('input'));
        }
        await flush();
        resolveFirst({ applications: [{ ...apps[0], label: '古い候補' }] });
        rejectSecond(new Error('PRIVATE'));
        await flush();
        expect(element.shadowRoot.querySelector('[role="option"]').textContent).toContain('最新候補');
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(input.disabled).toBe(false);
    });
    it('Escで検索を閉じた後の応答を捨て、クリックで検索し直す', async () => {
        const element = await createComponent();
        const input = element.shadowRoot.querySelector('input[role="combobox"]');
        let resolve;
        execute.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
        input.value = 'Target';
        input.dispatchEvent(new CustomEvent('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await flush();
        resolve({ applications: apps });
        await flush();
        expect(element.shadowRoot.querySelector('[role="listbox"]')).toBeNull();
        execute.mockResolvedValueOnce({ applications: apps });
        input.click();
        await flush();
        expect(execute).toHaveBeenLastCalledWith({ input: { action: 'list', term: 'Target' } });
        expect(element.shadowRoot.querySelector('[role="option"]')).not.toBeNull();
    });
    it('選択解除で旧資格情報を消し、空の条件で候補を再取得する', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state: 'rotated' }] });
        await select(element);
        execute.mockResolvedValueOnce({ applications: apps });
        const clearButton = element.shadowRoot.querySelector('button[title="選択を解除"]');
        clearButton.click();
        // 要素の差し替えによるblurが再検索を中止しないことを確認する。
        clearButton.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
        await flush();
        expect(execute).toHaveBeenLastCalledWith({ input: { action: 'list', term: '' } });
        expect(button(element)).toBeUndefined();
        expect(button(element, '削除')).toBeUndefined();
        expect(element.shadowRoot.querySelector('.slds-pill_container')).toBeNull();
        expect(element.shadowRoot.querySelector('input[role="combobox"]').getAttribute('aria-expanded')).toBe('true');
        expect(element.shadowRoot.activeElement).toBe(element.shadowRoot.querySelector('input[role="combobox"]'));
        await expect(element).toBeAccessible();
    });
    it('検索失敗と候補なしを区別し、再入力で復旧する', async () => {
        const element = await createComponent();
        const input = element.shadowRoot.querySelector('input[role="combobox"]');
        execute.mockRejectedValueOnce(new Error('PRIVATE'));
        input.value = 'Target';
        input.dispatchEvent(new CustomEvent('input'));
        await flush();
        expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();
        expect(element.shadowRoot.textContent).not.toContain('候補がありません');
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
        execute.mockResolvedValueOnce({ applications: [] });
        input.value = 'Absent';
        input.dispatchEvent(new CustomEvent('input'));
        await flush();
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('候補がありません');
    });
    it('生成と適用だけを実行し旧資格情報を表示する', async () => {
        const element = await createComponent();
        await select(element);
        LightningConfirm.open.mockResolvedValueOnce(true);
        updateResponses();
        button(element).click();
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'generate', 'apply']);
        expect(ExternalClientAppCredentialModal.open).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.querySelector('lightning-input')).toBeNull();
        expect(button(element, '削除').variant).toBe('destructive');
        expect(element.shadowRoot.textContent).toContain('適用済み');
        expect(element.shadowRoot.textContent).not.toContain('rotated');
        expect(element.shadowRoot.textContent).toContain('ステージ資格情報');
        expect(button(element, '削除')).toBeDefined();
        await expect(element).toBeAccessible();
    });
    it.each(['rotated', 'expired', 'unknown'])('残存する%sは手動整理まで生成を止める', async (state) => {
        const element = await createComponent();
        await select(element);
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state }, stage] });
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages']);
        expect(ExternalClientAppCredentialModal.open).not.toHaveBeenCalled();
        expect(element.shadowRoot.textContent).toContain(state === 'unknown' ? '標準設定画面で状態を確認' : state === 'expired' ? '期限切れの資格情報' : '手動で削除してから適用');
        expect(element.shadowRoot.textContent).toContain('old');
        await expect(element).toBeAccessible();
    });
    it('未適用だけがある場合は自動削除して生成・適用する', async () => {
        const element = await createComponent();
        await select(element);
        const pending = { id: 'pending', state: 'active' };
        execute
            .mockResolvedValueOnce({ stages: [pending] })
            .mockResolvedValueOnce({ state: 'complete', stages: [] })
            .mockResolvedValueOnce({ state: 'complete', stages: [stage] })
            .mockResolvedValueOnce({ state: 'complete', stages: [{ ...stage, state: 'rotated' }] });
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'deleteStage', 'generate', 'apply']);
        expect(execute.mock.calls[1][0].input).toMatchObject({ stageId: 'pending', stageState: 'active' });
        expect(LightningConfirm.open).not.toHaveBeenCalled();
    });
    it('未適用の削除中に旧認証が現れた場合も生成を止める', async () => {
        const element = await createComponent();
        await select(element);
        execute
            .mockResolvedValueOnce({ stages: [stage] })
            .mockResolvedValueOnce({ state: 'complete', stages: [{ id: 'other', state: 'rotated' }] });
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'deleteStage']);
        expect(element.shadowRoot.textContent).toContain('手動で削除してから適用');
    });
    it.each([
        ['unknown', '標準設定画面で状態を確認', '削除'],
        ['expired', '期限切れ', '連携先'],
        ['active', 'アプリを選択し直して現在の状態を確認', '削除']
    ])('未適用削除後に%sが現れた場合は状態に合う案内で停止する', async (state, expected, excluded) => {
        const element = await createComponent();
        await select(element);
        execute
            .mockResolvedValueOnce({ stages: [stage] })
            .mockResolvedValueOnce({ state: 'complete', stages: [{ id: 'other', state }] });
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'deleteStage']);
        const message = element.shadowRoot.querySelector('[role="alert"]').textContent;
        expect(message).toContain(expected);
        expect(message).not.toContain(excluded);
    });
    it.each(['generate', 'apply'])('%s結果が未確認なら再実行前の状態確認を案内する', async (phase) => {
        const element = await createComponent();
        await select(element);
        execute.mockImplementation(({ input }) => {
            if (input.action === 'stages') return Promise.resolve({ stages: [] });
            if (input.action === phase) return Promise.resolve({ state: 'unconfirmed' });
            return Promise.resolve({ state: 'complete', stages: [stage] });
        });
        button(element).click();
        await flush();
        expect(actions().at(-1)).toBe(phase);
        const message = element.shadowRoot.querySelector('[role="alert"]').textContent;
        expect(message).toContain('アプリを選択し直して現在の状態を確認');
        expect(message).toContain('状態を確認するまで再実行しない');
        expect(message).not.toContain('再実行してください');
    });
    it('未適用を一件に特定できない場合は自動削除も生成もしない', async () => {
        const element = await createComponent();
        await select(element);
        execute.mockResolvedValueOnce({ stages: [stage, { id: 'other', state: 'active' }] });
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages']);
    });
    it.each(['unconfirmed', 'remaining', 'rejected'])('未適用の自動削除が%sなら生成しない', async (state) => {
        const element = await createComponent();
        await select(element);
        execute.mockResolvedValueOnce({ stages: [stage] });
        if (state === 'rejected') {
            execute.mockRejectedValueOnce(new Error('PRIVATE'));
        } else {
            execute.mockResolvedValueOnce({ state: state === 'remaining' ? 'complete' : state, stages: [stage] });
        }
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'deleteStage']);
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
        expect(element.shadowRoot.textContent).toContain('未適用資格情報の削除');
    });
    it('画面を作り直してもAPIから旧資格情報を再取得する', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({
            stages: [{ id: 'persisted', state: 'rotated', expirationDate: '2030-01-01T00:00:00Z' }]
        });
        await select(element);
        expect(element.shadowRoot.textContent).toContain('persisted');
        element.remove();
        const reopened = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'persisted', state: 'rotated' }] });
        await select(reopened);
        expect(reopened.shadowRoot.textContent).toContain('persisted');
        expect(button(reopened, '削除')).toBeDefined();
    });
    it('手動削除は確認した行のIDと状態だけを送る', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state: 'rotated' }] });
        await select(element);
        LightningConfirm.open.mockResolvedValueOnce(true);
        execute.mockResolvedValueOnce({ state: 'complete', stages: [] });
        button(element, '削除').click();
        button(element, '削除').click();
        await flush();
        expect(actions()).toEqual(['deleteStage']);
        expect(execute.mock.calls[0][0].input).toMatchObject({
            stageId: 'old',
            stageState: 'rotated',
            confirmationId: apps[0].id
        });
        expect(element.shadowRoot.querySelector('section[aria-label="ステージ資格情報"]')).toBeNull();
        await expect(element).toBeAccessible();
    });
    it('手動削除キャンセルでは資格情報を残す', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state: 'rotated' }] });
        await select(element);
        LightningConfirm.open.mockResolvedValueOnce(false);
        button(element, '削除').click();
        await flush();
        expect(execute).not.toHaveBeenCalled();
        expect(element.shadowRoot.textContent).toContain('old');
    });
    it.each(['unconfirmed', 'notStarted', 'remaining'])('削除の%sでは成功を通知せず再取得を促す', async (state) => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state: 'rotated' }] });
        await select(element);
        const toast = jest.fn();
        element.addEventListener('lightning__showtoast', toast);
        LightningConfirm.open.mockResolvedValueOnce(true);
        execute.mockResolvedValueOnce({
            state: state === 'remaining' ? 'complete' : state,
            stages: [{ id: 'old', state: 'rotated' }]
        });
        button(element, '削除').click();
        await flush();
        expect(toast).not.toHaveBeenCalled();
        expect(element.shadowRoot.textContent).toContain('アプリを選択し直して現在の状態');
        expect(button(element, '削除')).toBeUndefined();
    });
    it('取得失敗を空一覧として表示しない', async () => {
        const element = await createComponent();
        execute.mockRejectedValueOnce(new Error('PRIVATE'));
        await select(element);
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
        expect(element.shadowRoot.textContent).not.toContain('ステージに残っている資格情報はありません');
        expect(button(element, '削除')).toBeUndefined();
    });
    it('適用失敗後の再実行では未適用を自動削除してやり直す', async () => {
        const element = await createComponent();
        await select(element);
        LightningConfirm.open.mockResolvedValue(true);
        execute
            .mockResolvedValueOnce({ stages: [] })
            .mockResolvedValueOnce({ state: 'complete', stages: [stage] })
            .mockRejectedValueOnce(new Error('PRIVATE'));
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'generate', 'apply']);
        execute.mockClear();
        execute
            .mockResolvedValueOnce({ stages: [stage] })
            .mockResolvedValueOnce({ state: 'complete', stages: [] })
            .mockResolvedValueOnce({ state: 'complete', stages: [stage] })
            .mockResolvedValueOnce({ state: 'complete', stages: [{ ...stage, state: 'rotated' }] });
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages', 'deleteStage', 'generate', 'apply']);
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
    });
    it.each(['stages', 'confirmation', 'deleteStage', 'generate', 'apply'])('%s待機中の離脱後は後続要求と成功通知を出さない', async (phase) => {
        const element = await createComponent();
        await select(element);
        let resolve;
        const pending = new Promise((done) => { resolve = done; });
        const results = {
            stages: { stages: phase === 'deleteStage' ? [stage] : [] },
            deleteStage: { state: 'complete', stages: [] },
            generate: { state: 'complete', stages: [stage] },
            apply: { state: 'complete', stages: [{ ...stage, state: 'rotated' }] }
        };
        execute.mockImplementation(({ input }) => (input.action === phase ? pending : Promise.resolve(results[input.action])));
        if (phase === 'confirmation') ExternalClientAppCredentialModal.open.mockReturnValueOnce(pending);
        const toast = jest.fn();
        element.addEventListener('lightning__showtoast', toast);
        button(element).click();
        await flush();
        const beforeRemoval = actions();
        element.remove();
        resolve(phase === 'confirmation' ? apps[0].id : results[phase]);
        await flush();
        expect(actions()).toEqual(beforeRemoval);
        expect(toast).not.toHaveBeenCalled();
    });
    it('同じ画面を再接続しても離脱前の生成結果を適用しない', async () => {
        const element = await createComponent();
        await select(element);
        let resolve;
        const pending = new Promise((done) => { resolve = done; });
        execute.mockResolvedValueOnce({ stages: [] }).mockReturnValueOnce(pending);
        button(element).click();
        await flush();
        element.remove();
        execute.mockResolvedValueOnce({ applications: apps });
        document.body.appendChild(element);
        await flush();
        resolve({ state: 'complete', stages: [stage] });
        await flush();
        expect(actions()).not.toContain('apply');
    });
    it('適用待機中に離脱して戻るとサーバーの適用済み状態を再取得する', async () => {
        const element = await createComponent();
        await select(element);
        let resolve;
        const pending = new Promise((done) => { resolve = done; });
        execute.mockResolvedValueOnce({ stages: [] })
            .mockResolvedValueOnce({ state: 'complete', stages: [stage] })
            .mockReturnValueOnce(pending);
        button(element).click();
        await flush();
        element.remove();
        execute.mockResolvedValueOnce({ applications: apps })
            .mockResolvedValueOnce({ stages: [{ ...stage, state: 'rotated' }] });
        document.body.appendChild(element);
        await flush();
        resolve({ state: 'complete', stages: [{ ...stage, state: 'rotated' }] });
        await flush();
        expect(actions()).toEqual(['stages', 'generate', 'apply', 'list', 'stages']);
        const cells = [...element.shadowRoot.querySelectorAll('tbody td')].map((cell) => cell.textContent);
        expect(cells).toContain('適用済み');
        expect(cells).not.toContain('未適用');
        await expect(element).toBeAccessible();
    });
    it('復帰時に選択アプリが候補から消えた場合は選択を解除する', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ ...stage, state: 'rotated' }] });
        await select(element);
        element.remove();
        execute.mockResolvedValueOnce({ applications: [] });
        document.body.appendChild(element);
        await flush();
        expect(actions()).toEqual(['list']);
        expect(element.shadowRoot.querySelector('input[role="combobox"]').value).toBe('');
        expect(button(element)).toBeUndefined();
        expect(button(element, '削除')).toBeUndefined();
    });
    it('復帰時の再取得に失敗しても離脱前の一覧を表示しない', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ ...stage, state: 'rotated' }] });
        await select(element);
        element.remove();
        execute.mockResolvedValueOnce({ applications: apps }).mockRejectedValueOnce(new Error('PRIVATE'));
        document.body.appendChild(element);
        await flush();
        expect(actions()).toEqual(['list', 'stages']);
        expect(button(element, '削除')).toBeUndefined();
        expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
    });
    it('手動削除の確認中に離脱した場合は削除しない', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state: 'rotated' }] });
        await select(element);
        let resolve;
        LightningConfirm.open.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
        button(element, '削除').click();
        await flush();
        element.remove();
        resolve(true);
        await flush();
        expect(execute).not.toHaveBeenCalled();
    });
    it.each(['generate', 'apply', 'deleteStage'])('%sの変更前拒否は公開案内を表示して後続を停止する', async (phase) => {
        const element = await createComponent();
        await select(element);
        execute.mockImplementation(({ input }) => {
            if (input.action === phase) return Promise.resolve({ state: 'notStarted', message: '公開された設定確認案内' });
            if (input.action === 'stages') return Promise.resolve({ stages: phase === 'deleteStage' ? [stage] : [] });
            return Promise.resolve({ state: 'complete', stages: [stage] });
        });
        const toast = jest.fn();
        element.addEventListener('lightning__showtoast', toast);
        button(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('公開された設定確認案内');
        expect(element.shadowRoot.textContent).not.toContain('完了を確認できません');
        expect(actions().at(-1)).toBe(phase);
        expect(toast).not.toHaveBeenCalled();
    });
    it('手動削除の変更前拒否も公開案内を表示する', async () => {
        const element = await createComponent();
        execute.mockResolvedValueOnce({ stages: [{ id: 'old', state: 'rotated' }] });
        await select(element);
        LightningConfirm.open.mockResolvedValueOnce(true);
        execute.mockResolvedValueOnce({ state: 'notStarted', message: '公開された削除拒否案内' });
        button(element, '削除').click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('公開された削除拒否案内');
        expect(element.shadowRoot.textContent).not.toContain('削除の完了を確認できません');
    });
    it('生成キャンセルは事前参照だけで変更を送らない', async () => {
        const element = await createComponent();
        await select(element);
        ExternalClientAppCredentialModal.open.mockResolvedValueOnce(null);
        button(element).click();
        await flush();
        expect(actions()).toEqual(['stages']);
    });
    it('空一覧ではセクションと再取得操作を表示しない', async () => {
        const element = await createComponent();
        await select(element);
        expect(element.shadowRoot.querySelector('section[aria-label="ステージ資格情報"]')).toBeNull();
        expect(button(element, '再取得')).toBeUndefined();
        expect(element.shadowRoot.querySelector('lightning-button-icon')).toBeNull();
    });
    it('未認証では標準認証リンクだけを表示する', async () => {
        const element = await createComponent({ status: 'REQUIRED', url: '/auth' });
        expect(element.shadowRoot.querySelector('a').getAttribute('href')).toBe('/auth');
        expect(element.shadowRoot.querySelector('input[role="combobox"]')).toBeNull();
    });
    it.each(['UNAVAILABLE', 'NO_ACCESS'])('確認結果%sでも認証を表示し操作は許可しない', async (status) => {
        const element = await createComponent({ status });
        expect(element.shadowRoot.querySelector('.authentication a').getAttribute('href')).toBe('/auth');
        expect(element.shadowRoot.querySelector('input[role="combobox"]')).toBeNull();
        expect(button(element, '認証解除')).toBeUndefined();
        expect(execute).not.toHaveBeenCalled();
        expect(getAuthenticationUrl).toHaveBeenCalledTimes(1);
    });
    it('状態取得の例外後も認証URLを独立して取得する', async () => {
        getAuthentication.mockRejectedValueOnce(new Error('PRIVATE'));
        const element = await createComponent();
        expect(element.shadowRoot.querySelector('.authentication a')).not.toBeNull();
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
        expect(element.shadowRoot.querySelector('input[role="combobox"]')).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });
    it('URL取得失敗では無効な認証ボタンと理由を表示する', async () => {
        getAuthenticationUrl.mockRejectedValueOnce(new Error('PRIVATE'));
        const element = await createComponent({ status: 'UNAVAILABLE' });
        expect(element.shadowRoot.querySelector('.authentication a')).toBeNull();
        expect(button(element, '認証').disabled).toBe(true);
        expect(element.shadowRoot.textContent).toContain('認証を開始できません');
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE');
        expect(execute).not.toHaveBeenCalled();
    });
    it('確認中も無効な認証ボタンを表示して機能を隠す', async () => {
        getAuthentication.mockImplementationOnce(() => new Promise(() => {}));
        const element = await createComponent();
        expect(button(element, '認証').disabled).toBe(true);
        expect(element.shadowRoot.querySelector('input[role="combobox"]')).toBeNull();
    });
    it('認証し直して戻った画面では接続を確認して操作を許可する', async () => {
        const before = await createComponent({ status: 'UNAVAILABLE' });
        expect(before.shadowRoot.querySelector('.authentication a')).not.toBeNull();
        before.remove();
        const after = await createComponent();
        expect(after.shadowRoot.querySelector('.authentication')).toBeNull();
        expect(after.shadowRoot.querySelector('input[role="combobox"]')).not.toBeNull();
        expect(button(after, '認証解除')).toBeDefined();
    });

});
