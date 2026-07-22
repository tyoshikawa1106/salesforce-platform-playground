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
});
