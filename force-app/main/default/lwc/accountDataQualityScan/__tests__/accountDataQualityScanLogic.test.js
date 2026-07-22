import { createScanViewModel } from '../accountDataQualityScanLogic';

const completedScan = {
    scanId: 'a00000000000001AAA',
    status: 'Completed',
    totalCount: 4,
    processedCount: 4,
    progressPercent: 100,
    missingPhoneCount: 1,
    missingIndustryCount: 2,
    missingAddressCount: 3,
    missingWebsiteCount: 4,
    missingAccountNumberCount: 2,
    startedAt: '2026-07-23T00:00:00.000Z',
    completedAt: '2026-07-23T00:01:00.000Z'
};

describe('accountDataQualityScanLogic', () => {
    it('履歴がない場合は表示モデルを作成しない', () => {
        expect(createScanViewModel(null)).toBeNull();
    });

    it('完了スキャンを再実行可能な表示モデルへ変換する', () => {
        expect(createScanViewModel(completedScan)).toEqual({
            ...completedScan,
            statusLabel: '完了',
            canStart: true,
            isActive: false,
            hasError: false,
            errorMessage: undefined
        });
    });

    it.each(['Pending', 'Running'])(
        '%s状態では新しい開始を許可しない',
        (status) => {
            expect(
                createScanViewModel({
                    ...completedScan,
                    status
                }).canStart
            ).toBe(false);
        }
    );

    it('進捗率と件数を画面で扱える範囲へ正規化する', () => {
        const result = createScanViewModel({
            status: 'Failed',
            progressPercent: 120,
            totalCount: undefined,
            errorMessage: '安全なエラー'
        });

        expect(result.progressPercent).toBe(100);
        expect(result.totalCount).toBe(0);
        expect(result.statusLabel).toBe('失敗');
        expect(result.hasError).toBe(true);
        expect(result.canStart).toBe(true);
    });

    it('画面操作中は終了済みスキャンでも開始を許可しない', () => {
        expect(createScanViewModel(completedScan, true).canStart).toBe(false);
    });
});
