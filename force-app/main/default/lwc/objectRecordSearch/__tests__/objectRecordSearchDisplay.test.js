import {
    createColumns,
    createDisplayRow,
    getSortFieldApiName
} from '../objectRecordSearchDisplay';

describe('objectRecordSearchDisplay', () => {
    it.each([
        ['Incoming', 'boolean', false],
        ['Incoming', 'boolean', true],
        ['Amount', 'number', 0],
        ['Amount', 'number', 1234.5],
        ['StartDateTime', 'date', '2026-09-07T00:00:00.123Z'],
        ['ActivityDate', 'date-local', '2026-09-07']
    ])('%s の型付き値 %s をセルまで保持する', (apiName, dataType, value) => {
        const fields = [{ apiName, dataType }];
        const row = createDisplayRow({ fieldValues: { [apiName]: value } }, fields);
        expect(row[`displayField_${apiName}`]).toBe(value);
        expect(createColumns({ displayFields: fields })[1].type).toBe(dataType);
    });

    it('creates datatable columns with display field types and row actions', () => {
        const columns = createColumns({
            nameFieldLabel: '取引先名',
            displayFields: [
                { apiName: 'Website', label: 'Webサイト', dataType: 'url' },
                { apiName: 'Email', label: 'メール', dataType: 'email' },
                { apiName: 'Phone', label: '電話', dataType: 'phone' },
                { apiName: 'Industry', label: '業種', dataType: 'text' }
            ],
            editDisabled: false
        });

        expect(columns).toEqual([
            expect.objectContaining({
                label: '取引先名',
                fieldName: 'recordUrl',
                type: 'url',
                sortable: true
            }),
            expect.objectContaining({
                label: 'Webサイト',
                fieldName: 'displayField_Website',
                type: 'url',
                typeAttributes: {
                    label: { fieldName: 'displayField_Website' },
                    target: '_blank'
                }
            }),
            expect.objectContaining({
                label: 'メール',
                fieldName: 'displayField_Email',
                type: 'email'
            }),
            expect.objectContaining({
                label: '電話',
                fieldName: 'displayField_Phone',
                type: 'phone'
            }),
            expect.objectContaining({
                label: '業種',
                fieldName: 'displayField_Industry',
                type: 'text'
            }),
            expect.objectContaining({
                type: 'action',
                typeAttributes: {
                    rowActions: [{ label: '編集', name: 'edit' }]
                }
            })
        ]);
    });

    it('maps fixed display field values onto datatable rows', () => {
        const row = createDisplayRow(
            {
                id: '001xx000003DGbYAAW',
                name: 'Acme',
                fieldValues: {
                    Industry: 'Technology',
                    Phone: null
                }
            },
            [
                { apiName: 'Industry', label: '業種' },
                { apiName: 'Phone', label: '電話' },
                { apiName: 'BillingCity', label: '市区郡' }
            ]
        );

        expect(row).toEqual(
            expect.objectContaining({
                id: '001xx000003DGbYAAW',
                name: 'Acme',
                displayField_Industry: 'Technology',
                displayField_Phone: '',
                displayField_BillingCity: ''
            })
        );
    });

    it('converts datatable sort field names to Apex API names', () => {
        expect(
            getSortFieldApiName({
                sortedBy: 'recordUrl',
                nameFieldApiName: 'Subject'
            })
        ).toBe('Subject');
        expect(
            getSortFieldApiName({
                sortedBy: 'displayField_Industry',
                nameFieldApiName: 'Name'
            })
        ).toBe('Industry');
        expect(
            getSortFieldApiName({
                sortedBy: 'unknown',
                nameFieldApiName: 'Name'
            })
        ).toBe('Name');
    });
});
