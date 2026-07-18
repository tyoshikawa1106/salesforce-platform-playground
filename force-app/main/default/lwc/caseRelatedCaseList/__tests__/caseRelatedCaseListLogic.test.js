import {
    createAllRelatedListsResetState,
    createCaseCard,
    createEmptyMessage,
    createRelatedListResetState,
    isRelatedListLoading,
    selectRelatedCaseRecords,
    shouldResetRelatedList
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

    it('親レコード変更時の取得状態を生成する', () => {
        expect(createRelatedListResetState('003000000000001')).toEqual({
            cases: [],
            hasLoaded: false,
            hasError: false
        });
        expect(createRelatedListResetState(undefined)).toEqual({
            cases: [],
            hasLoaded: true,
            hasError: false
        });
        expect(
            shouldResetRelatedList(
                '003000000000001',
                '003000000000002'
            )
        ).toBe(true);
        expect(
            shouldResetRelatedList(
                '003000000000001',
                '003000000000001'
            )
        ).toBe(false);
    });

    it('ローディング、空状態、全体リセットを生成する', () => {
        expect(isRelatedListLoading('003000000000001', false)).toBe(true);
        expect(isRelatedListLoading(undefined, false)).toBe(false);
        expect(
            createEmptyMessage({
                parentRecordId: '003000000000001',
                emptyMessage: '0件です',
                missingParentMessage: '未設定です'
            })
        ).toBe('0件です');
        expect(
            createEmptyMessage({
                parentRecordId: undefined,
                emptyMessage: '0件です',
                missingParentMessage: '未設定です'
            })
        ).toBe('未設定です');
        expect(createAllRelatedListsResetState()).toEqual({
            contactCases: [],
            accountCases: [],
            contactCasesHaveLoaded: true,
            accountCasesHaveLoaded: true,
            contactCasesHaveError: false,
            accountCasesHaveError: false
        });
    });
});
