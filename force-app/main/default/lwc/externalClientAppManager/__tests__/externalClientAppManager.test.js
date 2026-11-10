import { createElement } from 'lwc';
import { setImmediate } from 'timers';
import LightningConfirm from 'lightning/confirm';
import ExternalClientAppCredentialModal from 'c/externalClientAppCredentialModal';
import ExternalClientAppManager from 'c/externalClientAppManager';
import execute from '@salesforce/apex/ExternalClientAppManagerController.execute';
import getAuthentication from '@salesforce/apex/ExternalClientAppManagerController.getAuthentication';

jest.mock('@salesforce/apex/ExternalClientAppManagerController.execute', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/ExternalClientAppManagerController.getAuthentication', () => ({ default: jest.fn() }), {
    virtual: true
});
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
const button = (element, label = '新しいコンシューマ鍵と秘密を生成') =>
    [...element.shadowRoot.querySelectorAll('lightning-button')].find((item) => item.label === label);
const actions = () => execute.mock.calls.map(([r]) => r.input.action);
async function createComponent(authentication = { status: 'AUTHENTICATED' }) {
    getAuthentication.mockResolvedValue(authentication);
    ExternalClientAppCredentialModal.open.mockResolvedValue(apps[0].id);
    execute.mockResolvedValue({ stages: [] }).mockResolvedValueOnce({ applications: apps });
    const element = createElement('c-external-client-app-manager', { is: ExternalClientAppManager });
    document.body.appendChild(element);
    await flush();
    return element;
}
async function select(element) {
    element.shadowRoot
        .querySelector('lightning-combobox')
        .dispatchEvent(new CustomEvent('change', { detail: { value: apps[0].id } }));
    await flush();
    execute.mockClear();
}
function updateResponses() {
    execute
        .mockResolvedValueOnce({ stages: [] })
        .mockResolvedValueOnce({ state: 'complete', stages: [stage] })
        .mockResolvedValueOnce({ state: 'complete', stages: [{ ...stage, state: 'rotated' }] });
}
describe('旧資格情報を保持して手動削除する画面', () => {
    afterEach(() => {
        document.body.replaceChildren();
        jest.resetAllMocks();
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
        expect(element.shadowRoot.textContent).toContain('旧コンシューマ鍵と秘密');
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
        expect(element.shadowRoot.textContent).toContain('手動で削除してから生成');
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
        expect(element.shadowRoot.textContent).toContain('手動で削除してから生成');
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
        expect(element.shadowRoot.querySelector('section[aria-label="旧コンシューマ鍵と秘密"]')).toBeNull();
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
        expect(element.shadowRoot.querySelector('lightning-combobox').value).toBe('');
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
        expect(element.shadowRoot.querySelector('section[aria-label="旧コンシューマ鍵と秘密"]')).toBeNull();
        expect(button(element, '再取得')).toBeUndefined();
        expect(element.shadowRoot.querySelector('lightning-button-icon')).toBeNull();
    });
    it('未認証では標準認証リンクだけを表示する', async () => {
        const element = await createComponent({ status: 'REQUIRED', url: '/auth' });
        expect(element.shadowRoot.querySelector('a').getAttribute('href')).toBe('/auth');
        expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
    });
});
