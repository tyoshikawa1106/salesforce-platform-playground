import { createElement } from 'lwc';
import AccountDelete from 'c/accountDelete';
import getView from '@salesforce/apex/AccountDeleteController.getView';
import startRun from '@salesforce/apex/AccountDeleteController.startRun';
import AccountDeleteConfirm from 'c/accountDeleteConfirm';

jest.mock('@salesforce/apex/AccountDeleteController.getView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/AccountDeleteController.startRun', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('c/accountDeleteConfirm', () => ({ __esModule: true, default: { open: jest.fn() } }));

const allowed = { blockMessage: '', latestJob: {} };
async function flush() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}
async function mount() {
    const element = createElement('c-account-delete', { is: AccountDelete });
    document.body.appendChild(element);
    await flush();
    return element;
}
function executeButton(element) {
    return element.shadowRoot.querySelectorAll('lightning-button')[0];
}
function refreshButton(element) {
    return element.shadowRoot.querySelectorAll('lightning-button')[1];
}

describe('取引先一括削除画面', () => {
    beforeEach(() => {
        getView.mockResolvedValue(allowed);
    });
    afterEach(() => {
        document.body.replaceChildren();
        jest.resetAllMocks();
    });

    it('個人取引先と関連データへの影響を表示する', async () => {
        const element = await mount();
        expect(element.shadowRoot.textContent).toContain('個人取引先も対象');
        expect(executeButton(element).disabled).toBe(false);
        await expect(element).toBeAccessible();
    });


    it('画面を開き直しても前回の完了済みジョブを表示しない', async () => {
        getView.mockResolvedValue({ latestJob: { Id: 'previous', Status: 'Completed' } });
        const element = await mount();
        expect(element.shadowRoot.textContent).not.toContain('ジョブID:');
        expect(element.shadowRoot.textContent).not.toContain('処理状態: 完了');
        expect(executeButton(element).disabled).toBe(false);
        refreshButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).not.toContain('ジョブID:');
        expect(element.shadowRoot.textContent).not.toContain('処理状態: 完了');
    });

    it('開いた時点で実行中のジョブは完了まで表示し、再表示時は消す', async () => {
        getView.mockResolvedValue({ latestJob: { Id: 'running', Status: 'Processing' } });
        const element = await mount();
        expect(element.shadowRoot.textContent).toContain('処理状態: 進行中');
        expect(executeButton(element).disabled).toBe(true);
        getView.mockResolvedValue({ latestJob: { Id: 'running', Status: 'Completed' } });
        refreshButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('処理状態: 完了');
        expect(executeButton(element).disabled).toBe(false);
        element.remove();
        const reopened = await mount();
        expect(reopened.shadowRoot.textContent).not.toContain('ジョブID:');
        expect(reopened.shadowRoot.textContent).not.toContain('処理状態: 完了');
    });

    it('キャンセルでは開始要求を送らない', async () => {
        AccountDeleteConfirm.open.mockResolvedValue(false);
        const element = await mount();
        executeButton(element).click();
        await flush();
        expect(AccountDeleteConfirm.open).toHaveBeenCalledTimes(1);
        expect(startRun).not.toHaveBeenCalled();
        expect(executeButton(element).disabled).toBe(false);
    });

    it('確認中の連打を防止し、確定後に一度だけ受付する', async () => {
        let confirm;
        AccountDeleteConfirm.open.mockImplementation(
            () =>
                new Promise((resolve) => {
                    confirm = resolve;
                })
        );
        startRun.mockResolvedValue({ jobId: 'job-1', message: 'バッチを受け付けました。' });
        const element = await mount();
        executeButton(element).click();
        executeButton(element).click();
        await flush();
        expect(AccountDeleteConfirm.open).toHaveBeenCalledTimes(1);
        expect(startRun).not.toHaveBeenCalled();
        confirm(true);
        await flush();
        expect(startRun).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.textContent).toContain('job-1');
        expect(element.shadowRoot.textContent).toContain('処理状態: 待機中');
        expect(executeButton(element).disabled).toBe(true);
        await expect(element).toBeAccessible();
    });

    it('環境や権限の拒否理由を表示して開始しない', async () => {
        getView.mockResolvedValue({ blockMessage: '利用権限がありません。' });
        const element = await mount();
        executeButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('利用権限がありません。');
        expect(executeButton(element).disabled).toBe(true);
        expect(AccountDeleteConfirm.open).not.toHaveBeenCalled();
        await expect(element).toBeAccessible();
    });

    it('確認後のサーバー拒否を受付成功として扱わない', async () => {
        AccountDeleteConfirm.open.mockResolvedValue(true);
        startRun.mockResolvedValue({ blockMessage: '実行中の取引先削除があります。' });
        const element = await mount();
        executeButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('実行中の取引先削除があります。');
        expect(element.shadowRoot.textContent).not.toContain('ジョブID');
        expect(executeButton(element).disabled).toBe(true);
    });

    it('通信エラーの内部情報を公開せず再取得まで開始を禁止する', async () => {
        AccountDeleteConfirm.open.mockResolvedValue(true);
        startRun.mockRejectedValue(new Error('PRIVATE_INTERNAL_ERROR'));
        const element = await mount();
        executeButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('受付結果を確認できませんでした');
        expect(element.shadowRoot.textContent).not.toContain('PRIVATE_INTERNAL_ERROR');
        expect(executeButton(element).disabled).toBe(true);
        refreshButton(element).click();
        await flush();
        expect(executeButton(element).disabled).toBe(false);
    });

    it('受付後の再取得失敗でもジョブIDを保持し、同じジョブの完了後に再実行できる', async () => {
        AccountDeleteConfirm.open.mockResolvedValue(true);
        startRun.mockResolvedValue({ jobId: 'job-1', message: '受付済み' });
        const element = await mount();
        executeButton(element).click();
        await flush();
        getView.mockRejectedValueOnce(new Error('failed'));
        refreshButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('job-1');
        expect(executeButton(element).disabled).toBe(true);
        getView.mockResolvedValue({
            latestJob: {
                Id: 'job-1',
                Status: 'Completed'
            }
        });
        refreshButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('処理状態: 完了');
        expect(executeButton(element).disabled).toBe(false);
    });


    it('最新の実行状況を取得して待機中から進行中、完了へ更新する', async () => {
        getView.mockResolvedValueOnce({ latestJob: { Id: 'previous', Status: 'Completed' } });
        AccountDeleteConfirm.open.mockResolvedValue(true);
        startRun.mockResolvedValue({ jobId: 'current' });
        const element = await mount();
        expect(refreshButton(element).label).toBe('実行状況を確認');
        expect(element.shadowRoot.textContent).toContain('処理状態は自動更新されません');
        executeButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('処理状態: 待機中');
        expect(element.shadowRoot.textContent).not.toContain('処理状態: 完了');
        getView.mockResolvedValue({ latestJob: { Id: 'current', Status: 'Processing' } });
        refreshButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('処理状態: 進行中');
        getView.mockResolvedValue({ latestJob: { Id: 'current', Status: 'Completed' } });
        refreshButton(element).click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('処理状態: 完了');
    });

    it('別の最新ジョブが存在しても表示中のIDで状態を取得する', async () => {
        getView.mockImplementation(({ jobId }) => Promise.resolve({
            latestJob: jobId ? { Id: jobId, Status: 'Completed' } : { Id: 'A', Status: 'Processing' }
        }));
        const element = await mount();
        expect(getView).toHaveBeenLastCalledWith({ jobId: null });
        // 最新ジョブBが存在する状況で、ID指定時だけAを返す
        getView.mockImplementation(({ jobId }) => Promise.resolve({
            latestJob: jobId ? { Id: jobId, Status: 'Completed' } : { Id: 'B', Status: 'Processing' }
        }));
        refreshButton(element).click();
        await flush();
        expect(getView).toHaveBeenLastCalledWith({ jobId: 'A' });
        expect(element.shadowRoot.textContent).toContain('ジョブID: A');
        expect(element.shadowRoot.textContent).toContain('処理状態: 完了');
        expect(executeButton(element).disabled).toBe(false);
        refreshButton(element).click();
        await flush();
        expect(getView).toHaveBeenLastCalledWith({ jobId: 'A' });
        expect(executeButton(element).disabled).toBe(false);
    });

    it('取得失敗では開始を許可せず再取得で回復する', async () => {
        getView.mockRejectedValueOnce(new Error('private query'));
        const element = await mount();
        expect(executeButton(element).disabled).toBe(true);
        expect(element.shadowRoot.textContent).not.toContain('private query');
        refreshButton(element).click();
        await flush();
        expect(executeButton(element).disabled).toBe(false);
    });
});
