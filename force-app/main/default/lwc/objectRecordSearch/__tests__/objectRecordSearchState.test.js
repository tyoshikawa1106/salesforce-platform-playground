import {
    createAccessMessages,
    createInitialPaginationState,
    createNextPageState,
    createPaginationStateFromResponse,
    createPreviousPageState,
    normalizeSortDirection
} from '../objectRecordSearchState';

describe('objectRecordSearchState', () => {
    it('creates default pagination and sort state values', () => {
        expect(createInitialPaginationState()).toEqual({
            pageNumber: 1,
            pageSize: 50,
            currentPageToken: undefined,
            nextPageToken: undefined,
            pageTokenHistory: [],
            hasNextPage: false
        });
        expect(normalizeSortDirection('desc')).toBe('desc');
        expect(normalizeSortDirection('invalid')).toBe('asc');
    });

    it('creates pagination state from response and page navigation values', () => {
        expect(createPaginationStateFromResponse({}, 25)).toEqual({
            pageNumber: 1,
            pageSize: 25,
            nextPageToken: undefined,
            hasNextPage: false
        });
        expect(
            createNextPageState({
                pageNumber: 1,
                pageTokenHistory: [],
                nextPageToken: 'token-2'
            })
        ).toEqual({
            pageNumber: 2,
            currentPageToken: 'token-2',
            pageTokenHistory: ['token-2']
        });
        expect(
            createPreviousPageState({
                pageNumber: 3,
                pageTokenHistory: ['token-2', 'token-3']
            })
        ).toEqual({
            pageNumber: 2,
            currentPageToken: 'token-2',
            pageTokenHistory: ['token-2']
        });
    });

    it('creates access messages for unavailable record actions', () => {
        expect(
            createAccessMessages({
                config: {
                    objectLabel: '取引先',
                    searchable: false,
                    createable: false,
                    updateable: false,
                    deletable: false
                },
                formCapabilityMessage: 'フォームを使えません。',
                isFileUploadObject: false,
                isRecordFormObject: true,
                shouldShowFormFieldMessage: true,
                hasFormLayoutError: true
            })
        ).toEqual([
            { key: 'form-capability', message: 'フォームを使えません。' },
            {
                key: 'searchable',
                message: '取引先の検索対象項目を参照できないため、検索条件を使えません。'
            },
            { key: 'createable', message: '取引先を作成する権限がありません。' },
            { key: 'updateable', message: '取引先を編集する権限がありません。' },
            { key: 'deletable', message: '取引先を削除する権限がありません。' },
            {
                key: 'form-fields',
                message: '取引先の作成・編集に使える標準項目がありません。'
            },
            {
                key: 'layout-fallback',
                message: 'ページレイアウトを取得できないため、標準の入力項目で表示します。'
            }
        ]);
    });

    it('does not create access messages without a config', () => {
        expect(createAccessMessages({ config: undefined })).toEqual([]);
    });
});
