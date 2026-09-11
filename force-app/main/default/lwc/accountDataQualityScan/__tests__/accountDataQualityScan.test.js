import { createElement } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import AccountDataQualityScan from 'c/accountDataQualityScan';
import getLatestScan from '@salesforce/apex/AccountDataQualityScanController.getLatestScan';
import startScan from '@salesforce/apex/AccountDataQualityScanController.startScan';

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn()
    }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/AccountDataQualityScanController.getLatestScan',
    () => {
        const {
            createApexTestWireAdapter
        } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/AccountDataQualityScanController.startScan',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

const runningScan = {
    scanId: 'a00000000000001AAA',
    status: 'Running',
    totalCount: 10,
    processedCount: 5,
    progressPercent: 50,
    missingPhoneCount: 1,
    missingIndustryCount: 2,
    missingAddressCount: 3,
    missingWebsiteCount: 4,
    missingAccountNumberCount: 5,
    startedAt: '2026-07-23T00:00:00.000Z'
};

function createComponent() {
    const element = createElement('c-account-data-quality-scan', {
        is: AccountDataQualityScan
    });
    document.body.appendChild(element);
    return element;
}

async function flushPromises() {
    await Promise.resolve();
}

describe('c-account-data-quality-scan', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('履歴がない場合に最初のスキャン開始を案内する', async () => {
        const element = createComponent();

        getLatestScan.emit(null);
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'スキャン履歴はありません。'
        );
        expect(
            element.shadowRoot.querySelector('lightning-button').disabled
        ).toBe(false);
        await expect(element).toBeAccessible();
    });

    it('処理中スキャンの進捗と不足件数を表示する', async () => {
        const element = createComponent();

        getLatestScan.emit(runningScan);
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('処理中');
        expect(element.shadowRoot.querySelectorAll('article')).toHaveLength(5);
        expect(
            element.shadowRoot.querySelector('lightning-progress-bar').value
        ).toBe(50);
        expect(
            element.shadowRoot.querySelector('lightning-button').disabled
        ).toBe(true);
        await expect(element).toBeAccessible();
    });

    it('完了または失敗後に新しいスキャンを開始できる', async () => {
        const element = createComponent();

        getLatestScan.emit({
            ...runningScan,
            status: 'Completed',
            processedCount: 10,
            progressPercent: 100
        });
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('lightning-button').disabled
        ).toBe(false);
    });

    it('開始操作後に成功を通知して状態を更新する', async () => {
        const element = createComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        startScan.mockResolvedValue({ ...runningScan, status: 'Pending' });
        refreshApex.mockResolvedValue();

        getLatestScan.emit(null);
        await flushPromises();
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();

        expect(startScan).toHaveBeenCalledTimes(1);
        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
    });

    it('開始失敗を画面とエラートーストへ表示する', async () => {
        const element = createComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        startScan.mockRejectedValue({
            body: { message: '実行中のスキャンがあります。' }
        });

        getLatestScan.emit(null);
        await flushPromises();
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();

        expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();
        expect(element.shadowRoot.textContent).toContain(
            '実行中のスキャンがあります。'
        );
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
    });

    it('手動更新で最新スキャンを再取得する', async () => {
        const element = createComponent();
        refreshApex.mockResolvedValue();

        getLatestScan.emit(runningScan);
        await flushPromises();
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
    });

    it('状態取得失敗を画面上のエラーとして表示する', async () => {
        const element = createComponent();

        getLatestScan.error({
            body: { message: '状態取得に失敗しました。' }
        });
        await flushPromises();

        expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();
        expect(element.shadowRoot.textContent).toContain(
            'スキャン状態を読み込めませんでした。時間をおいてもう一度お試しください。'
        );
        await expect(element).toBeAccessible();
    });

    it('開始後の再取得失敗でも待機状態を保持し開始失敗と通知しない', async () => {
        const element = createComponent();
        const toast = jest.fn();
        element.addEventListener('lightning__showtoast', toast);
        startScan.mockResolvedValueOnce({ ...runningScan, status: 'Pending' });
        refreshApex.mockImplementationOnce(async () => {
            getLatestScan.error({ message: '再取得エラー' });
            throw new Error('再取得エラー');
        });
        getLatestScan.emit(null);
        await flushPromises();
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();
        await flushPromises();
        expect(toast.mock.calls.map(([event]) => event.detail.variant)).toEqual(['success']);
        expect(element.shadowRoot.querySelector('lightning-button').disabled).toBe(true);
        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('再取得エラー');
        expect(element.shadowRoot.querySelector('lightning-button-icon').disabled).toBe(false);
        refreshApex.mockImplementationOnce(async () => {
            getLatestScan.emit({ ...runningScan, status: 'Completed' });
        });
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.textContent).toContain('完了');
        expect(element.shadowRoot.querySelector('lightning-button').disabled).toBe(false);
    });

    it.each(['取引先の参照権限がありません。', 'スキャン結果の参照権限がありません。'])(
        '権限不足を表示して結果と開始操作を抑止する: %s',
        async (accessErrorMessage) => {
            const element = createComponent();
            getLatestScan.emit({ accessErrorMessage });
            await flushPromises();

            expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain(accessErrorMessage);
            expect(element.shadowRoot.textContent).not.toContain('スキャン履歴はありません。');
            expect(element.shadowRoot.querySelectorAll('article')).toHaveLength(0);
            const startButton = element.shadowRoot.querySelector('lightning-button');
            expect(startButton.disabled).toBe(true);
            startButton.click();
            await flushPromises();
            expect(startScan).not.toHaveBeenCalled();
            await expect(element).toBeAccessible();
        }
    );

    it('状態更新で権限不足になったら古い結果を消し、回復後は履歴なし表示へ復帰する', async () => {
        const element = createComponent();
        getLatestScan.emit({ ...runningScan, status: 'Completed' });
        await flushPromises();
        expect(element.shadowRoot.querySelectorAll('article')).toHaveLength(5);
        const accessErrorMessage = '参照権限がありません。';
        refreshApex.mockImplementationOnce(async () => {
            getLatestScan.emit({ accessErrorMessage });
        });
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain(accessErrorMessage);
        expect(element.shadowRoot.querySelectorAll('article')).toHaveLength(0);
        expect(element.shadowRoot.querySelector('lightning-button').disabled).toBe(true);

        refreshApex.mockImplementationOnce(async () => getLatestScan.emit(null));
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('スキャン履歴はありません。');
        expect(element.shadowRoot.querySelector('lightning-button').disabled).toBe(false);
    });

    it('開始要求が参照権限不足で拒否されたら成功通知せず開始を抑止する', async () => {
        const element = createComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        const accessErrorMessage = '参照権限がありません。';
        startScan.mockResolvedValueOnce({ accessErrorMessage });
        getLatestScan.emit(null);
        await flushPromises();
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain(accessErrorMessage);
        expect(element.shadowRoot.querySelector('lightning-button').disabled).toBe(true);
        expect(element.shadowRoot.textContent).not.toContain('スキャン履歴はありません。');
        expect(toastHandler).not.toHaveBeenCalled();
        expect(refreshApex).not.toHaveBeenCalled();
    });

});
