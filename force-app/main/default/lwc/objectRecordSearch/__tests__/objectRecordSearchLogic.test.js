import {
    createSearchFailureState,
    createSearchRequest,
    createSearchSuccessState
} from '../objectRecordSearchLogic';

describe('objectRecordSearchLogic', () => {
    it('画面状態からApex検索要求を生成する', () => {
        expect(
            createSearchRequest({
                metricKey: 'accounts',
                searchTerm: 'Acme',
                currentPageToken: 'page-token',
                sortedBy: 'displayField_Industry',
                sortedDirection: 'desc',
                pageNumber: 2,
                config: { nameFieldApiName: 'Name' }
            })
        ).toEqual({
            metricKey: 'accounts',
            searchTerm: 'Acme',
            pageToken: 'page-token',
            sortBy: 'Industry',
            sortDirection: 'desc',
            pageNumber: 2
        });
    });

    it('Apex検索成功応答を一覧とページング状態へ変換する', () => {
        const state = createSearchSuccessState(
            {
                config: {
                    displayFields: [
                        {
                            apiName: 'Industry',
                            label: '業種',
                            dataType: 'text'
                        }
                    ]
                },
                records: [
                    {
                        id: '001000000000001',
                        name: 'Acme',
                        fieldValues: { Industry: 'Technology' }
                    }
                ],
                pageNumber: 2,
                pageSize: 25,
                nextPageToken: 'next-token',
                hasNextPage: true
            },
            50
        );

        expect(state).toEqual(
            expect.objectContaining({
                rows: [
                    expect.objectContaining({
                        id: '001000000000001',
                        displayField_Industry: 'Technology'
                    })
                ],
                pageNumber: 2,
                pageSize: 25,
                nextPageToken: 'next-token',
                hasNextPage: true,
                selectedRowIds: [],
                errorTitle: undefined,
                errorMessage: undefined
            })
        );
    });

    it('権限エラーを一覧を残さない画面状態へ変換する', () => {
        expect(
            createSearchFailureState({
                status: 403,
                body: { message: 'Forbidden' }
            })
        ).toEqual({
            rows: [],
            nextPageToken: undefined,
            hasNextPage: false,
            selectedRowIds: [],
            errorTitle: 'アクセス権限を確認してください',
            errorMessage: 'Forbidden'
        });
    });
});
