import {
    createFormViewState,
    createFormWireState,
    createInitialSearchState,
    createNextSearchState,
    createPreviousSearchState,
    createSearchCriteriaState,
    createSearchFailureState,
    createSearchRequest,
    createSearchSuccessState,
    createSortSearchState,
    createTableColumns
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

    it('検索条件、ソート、ページ移動を画面単位の状態へ変換する', () => {
        expect(createInitialSearchState()).toEqual({
            sortedBy: 'recordUrl',
            sortedDirection: 'asc',
            pageNumber: 1,
            pageSize: 50,
            currentPageToken: undefined,
            nextPageToken: undefined,
            pageTokenHistory: [],
            hasNextPage: false
        });
        expect(createSearchCriteriaState('  Acme  ')).toEqual(
            expect.objectContaining({
                searchTerm: 'Acme',
                pageNumber: 1,
                pageTokenHistory: []
            })
        );
        expect(
            createNextSearchState({
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
            createPreviousSearchState({
                pageNumber: 3,
                pageTokenHistory: ['token-2', 'token-3']
            })
        ).toEqual({
            pageNumber: 2,
            currentPageToken: 'token-2',
            pageTokenHistory: ['token-2']
        });
        expect(
            createSortSearchState({
                fieldName: 'displayField_Industry',
                sortDirection: 'desc'
            })
        ).toEqual(
            expect.objectContaining({
                sortedBy: 'displayField_Industry',
                sortedDirection: 'desc',
                pageNumber: 1,
                pageTokenHistory: []
            })
        );
    });

    it('検索設定からテーブル列とフォーム画面全体の状態を生成する', () => {
        const config = {
            objectApiName: 'Account',
            objectLabel: '取引先',
            nameFieldApiName: 'Name',
            nameFieldLabel: '取引先名',
            displayFields: [],
            searchable: true,
            createable: true,
            updateable: true,
            deletable: true
        };
        const objectInfoResult = {
            data: { defaultRecordTypeId: '012000000000001', fields: {} }
        };
        const formWireState = createFormWireState({
            config,
            objectInfoResult,
            formRecordId: undefined
        });
        const formViewState = createFormViewState({
            config,
            objectInfoResult,
            formLayoutResult: {
                error: { status: 403 }
            },
            formRecordId: undefined,
            formWireState
        });

        expect(createTableColumns({ config, editDisabled: false })).toEqual([
            expect.objectContaining({
                label: '取引先名',
                fieldName: 'recordUrl'
            }),
            expect.objectContaining({ type: 'action' })
        ]);
        expect(formWireState).toEqual(
            expect.objectContaining({
                layoutObjectApiName: 'Account',
                layoutMode: 'Create',
                defaultRecordTypeId: '012000000000001'
            })
        );
        expect(
            createFormWireState({
                config,
                objectInfoResult,
                formRecordId: '001000000000001'
            }).layoutMode
        ).toBe('Edit');
        expect(formViewState).toEqual(
            expect.objectContaining({
                createUnavailable: false,
                editUnavailable: false,
                isRecordFormObject: true,
                isFormLayoutLoading: false,
                newButtonLabel: '新規',
                hasAccessMessages: true,
                formTitle: '取引先を作成'
            })
        );
        expect(formViewState.formSections[0].fields).toEqual([
            { apiName: 'Name', required: true },
            { apiName: 'Industry', required: false }
        ]);
        expect(formViewState.accessMessages).toContainEqual({
            key: 'layout-fallback',
            message: 'ページレイアウトを取得できないため、標準の入力項目で表示します。'
        });
    });
});
