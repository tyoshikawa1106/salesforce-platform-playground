import {
    createCaseCard,
    selectRelatedCaseRecords
} from '../caseRelatedCaseListLogic';

describe('caseRelatedCaseListLogic', () => {
    it('表示中Caseを含めて作成日時の降順で最大20件を選別する', () => {
        const records = Array.from({ length: 21 }, (_, index) => ({
            id: `5000000000000${String(index).padStart(2, '0')}`,
            fields: {
                CreatedDate: {
                    value: `2026-07-${String(31 - index).padStart(2, '0')}T00:00:00.000Z`
                }
            }
        }));
        const currentRecord = {
            id: '500000000000099',
            fields: {
                CreatedDate: { value: '2026-06-01T00:00:00.000Z' }
            }
        };

        expect(selectRelatedCaseRecords(records, currentRecord)).toEqual([
            ...records.slice(0, 19),
            currentRecord
        ]);
    });

    it('参照できない値を代替表示へ変換してカードを生成する', () => {
        expect(
            createCaseCard({
                id: '500000000000001',
                caseNumber: undefined,
                subject: undefined,
                status: undefined,
                reason: undefined,
                createdDate: '2026-07-19T00:00:00.000Z',
                accountName: undefined,
                contactName: undefined,
                url: undefined
            })
        ).toEqual({
            id: '500000000000001',
            caseNumber: '-',
            subject: '（件名なし）',
            status: '-',
            reason: '-',
            createdDate: '2026-07-19T00:00:00.000Z',
            accountName: '-',
            contactName: '-',
            hasUrl: false,
            url: undefined
        });
    });

});
