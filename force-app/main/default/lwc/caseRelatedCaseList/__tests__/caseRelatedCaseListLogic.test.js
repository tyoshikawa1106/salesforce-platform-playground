import {
    createCaseCard,
    selectRelatedCaseRecords
} from '../caseRelatedCaseListLogic';

describe('caseRelatedCaseListLogic', () => {
    it('表示中Caseを除外して最大5件を選別する', () => {
        const records = Array.from({ length: 7 }, (_, index) => ({
            id: `50000000000000${index}`
        }));

        expect(
            selectRelatedCaseRecords(records, '500000000000000')
        ).toEqual(records.slice(1, 6));
    });

    it('参照できない値を代替表示へ変換してカードを生成する', () => {
        expect(
            createCaseCard({
                id: '500000000000001',
                caseNumber: undefined,
                subject: undefined,
                status: undefined,
                lastModifiedDate: '2026-07-19T00:00:00.000Z',
                url: undefined
            })
        ).toEqual({
            id: '500000000000001',
            caseNumber: '-',
            subject: '（件名なし）',
            status: '-',
            lastModifiedDate: '2026-07-19T00:00:00.000Z',
            url: undefined
        });
    });

});
