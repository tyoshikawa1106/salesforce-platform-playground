import { createElement } from 'lwc';
import TestDataDelete from 'c/testDataDelete';
import LightningConfirm from 'lightning/confirm';
import getView from '@salesforce/apex/TestDataDeleteController.getView';
import getRemaining from '@salesforce/apex/TestDataDeleteController.getRemaining';
import startRun from '@salesforce/apex/TestDataDeleteController.startRun';

jest.mock('@salesforce/apex/TestDataDeleteController.getView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/TestDataDeleteController.getRemaining', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/TestDataDeleteController.startRun', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('lightning/confirm', () => ({ __esModule: true, default: { open: jest.fn() } }), { virtual: true });

const initial = {
    objectNames: ['Contact', 'Account'],
    labels: { Contact: '取引先責任者', Account: '取引先' },
    unavailableObjects: [],
    executionState: 'IDLE',
    jobs: [],
    errorMessage: ''
};
async function flush() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}
const buttons = (element) => element.shadowRoot.querySelectorAll('lightning-button');
async function mount() {
    const element = createElement('c-test-data-delete', { is: TestDataDelete });
    document.body.appendChild(element);
    await flush();
    return element;
}

describe('削除の確認と受付', () => {
    beforeEach(() => {
        getView.mockResolvedValue(initial);
        getRemaining.mockImplementation(({ objectName }) =>
            Promise.resolve({ objectName, remaining: 1, errorMessage: '' })
        );
        LightningConfirm.open.mockResolvedValue(true);
        startRun.mockResolvedValue({ ...initial, jobId: 'new-job', executionState: 'RUNNING' });
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.resetAllMocks();
    });
    it('順序・残件数を表示しアクセシビリティを満たす', async () => {
        const element = await mount();
        expect(element.shadowRoot.querySelectorAll('tbody tr')).toHaveLength(2);
        expect(buttons(element)[0].disabled).toBe(false);
        expect(startRun).not.toHaveBeenCalled();
        await expect(element).toBeAccessible();
    });
    it('権限がなければ件数を照会しない', async () => {
        getView.mockResolvedValue({ ...initial, errorMessage: '「すべてのデータの編集」権限が必要です。' });
        const element = await mount();
        expect(buttons(element)[0].disabled).toBe(true);
        expect(getRemaining).not.toHaveBeenCalled();
        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('権限');
    });
    it('確認をキャンセルすると起動しない', async () => {
        LightningConfirm.open.mockResolvedValue(false);
        const element = await mount();
        buttons(element)[0].click();
        await flush();
        expect(startRun).not.toHaveBeenCalled();
        expect(buttons(element)[0].disabled).toBe(false);
    });
    it('受付後は二重起動せず同じジョブを照会する', async () => {
        const element = await mount();
        buttons(element)[0].click();
        buttons(element)[0].click();
        await flush();
        expect(startRun).toHaveBeenCalledTimes(1);
        expect(startRun).toHaveBeenCalledWith({ confirmation: 'DELETE_ALL' });
        expect(buttons(element)[0].disabled).toBe(true);
        buttons(element)[1].click();
        await flush();
        expect(getView).toHaveBeenLastCalledWith({ jobId: 'new-job' });
    });
    it('残件数の取得失敗では古い結果から開始できない', async () => {
        const element = await mount();
        getRemaining.mockRejectedValue(new Error('internal'));
        buttons(element)[1].click();
        await flush();
        expect(buttons(element)[0].disabled).toBe(true);
        expect(element.shadowRoot.textContent).not.toContain('internal');
    });
    it('受付の応答欠落を過去の完了結果で解消しない', async () => {
        const element = await mount();
        startRun.mockRejectedValue(new Error('lost response'));
        buttons(element)[0].click();
        await flush();
        expect(element.shadowRoot.textContent).toContain('受付不明');
        buttons(element)[1].click();
        await flush();
        expect(buttons(element)[0].disabled).toBe(true);
        expect(startRun).toHaveBeenCalledTimes(1);
    });
    it('後続の権限拒否で件数確認を中止する', async () => {
        getRemaining.mockResolvedValue({ errorMessage: '権限が変更されました。' });
        const element = await mount();
        expect(getRemaining).toHaveBeenCalledTimes(2);
        expect(buttons(element)[0].disabled).toBe(true);
        expect(element.shadowRoot.textContent).toContain('権限が変更されました');
    });
});
