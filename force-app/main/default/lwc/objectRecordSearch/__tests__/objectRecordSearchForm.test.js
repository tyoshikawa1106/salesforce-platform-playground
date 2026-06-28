import {
    FORM_MODE_FILE_UPLOAD,
    FORM_MODE_RECORD,
    applyFormFieldOverrides,
    createFallbackFormSections,
    createLayoutFormSections,
    getCurrentLayout,
    getObjectUiCapability
} from '../objectRecordSearchForm';

function createFieldInfo(overrides = {}) {
    return {
        custom: false,
        createable: true,
        updateable: true,
        ...overrides
    };
}

function createLayout({ heading = '基本情報', fields = [] } = {}) {
    return {
        sections: [
            {
                heading,
                layoutRows: [
                    {
                        layoutItems: fields.map((field) => ({
                            editableForNew: field.editableForNew ?? true,
                            editableForUpdate: field.editableForUpdate ?? true,
                            required: field.required ?? false,
                            layoutComponents: [
                                {
                                    apiName: field.apiName,
                                    componentType:
                                        field.componentType ?? 'Field'
                                }
                            ]
                        }))
                    }
                ]
            }
        ]
    };
}

describe('objectRecordSearchForm', () => {
    it('returns object-specific form capabilities', () => {
        expect(getObjectUiCapability('Account')).toEqual({
            formMode: FORM_MODE_RECORD,
            newButtonLabel: '新規'
        });
        expect(getObjectUiCapability('ContentDocument')).toEqual({
            formMode: FORM_MODE_FILE_UPLOAD,
            newButtonLabel: 'アップロード',
            message: 'ファイルはアップロードで新規登録します。'
        });
        expect(getObjectUiCapability('EmailMessage')).toEqual({
            formMode: 'unsupported',
            newButtonLabel: '新規',
            message: 'メールメッセージは汎用フォームの対象外です。'
        });
    });

    it('selects the current UI API layout for the object and mode', () => {
        const createLayoutData = createLayout({
            fields: [{ apiName: 'Name' }]
        });
        const editLayoutData = createLayout({
            fields: [{ apiName: 'Industry' }]
        });
        const formLayoutData = {
            layouts: {
                Account: {
                    Full: {
                        Create: createLayoutData,
                        Edit: editLayoutData
                    }
                }
            }
        };

        expect(
            getCurrentLayout({
                formLayoutData,
                objectApiName: 'Account',
                layoutMode: 'Edit'
            })
        ).toBe(editLayoutData);
    });

    it('creates layout sections from editable standard fields only', () => {
        const sections = createLayoutFormSections({
            layout: createLayout({
                fields: [
                    { apiName: 'Name', required: true },
                    { apiName: 'Industry' },
                    { apiName: 'Custom_Text__c' },
                    { apiName: 'Hidden__c', editableForNew: false },
                    { apiName: 'NotField', componentType: 'EmptySpace' },
                    { apiName: 'Industry' }
                ]
            }),
            fieldInfoByApiName: {
                Name: createFieldInfo(),
                Industry: createFieldInfo(),
                Custom_Text__c: createFieldInfo({ custom: true }),
                Hidden__c: createFieldInfo()
            }
        });

        expect(sections).toEqual([
            {
                key: 'section-0',
                headingId: 'object-record-form-section-0',
                label: '基本情報',
                fields: [
                    { apiName: 'Name', required: true },
                    { apiName: 'Industry', required: false }
                ]
            }
        ]);
    });

    it('applies object field overrides without duplicating existing fields', () => {
        const sections = applyFormFieldOverrides({
            sections: [
                {
                    key: 'section-0',
                    headingId: 'object-record-form-section-0',
                    label: '基本情報',
                    fields: [{ apiName: 'Name', required: false }]
                }
            ],
            objectApiName: 'Opportunity',
            fieldInfoByApiName: {
                Name: createFieldInfo(),
                StageName: createFieldInfo(),
                CloseDate: createFieldInfo()
            }
        });

        expect(sections[0].fields).toEqual([
            { apiName: 'Name', required: true },
            { apiName: 'StageName', required: true },
            { apiName: 'CloseDate', required: true }
        ]);
    });

    it('keeps empty sections empty when object field overrides exist', () => {
        expect(
            applyFormFieldOverrides({
                sections: [],
                objectApiName: 'Opportunity',
                fieldInfoByApiName: {
                    Name: createFieldInfo(),
                    StageName: createFieldInfo(),
                    CloseDate: createFieldInfo()
                }
            })
        ).toEqual([]);
    });

    it('creates fallback sections from configured fields or the name field', () => {
        expect(
            createFallbackFormSections({
                objectApiName: 'Lead',
                nameFieldApiName: 'Name'
            })[0].fields
        ).toEqual([
            { apiName: 'FirstName', required: true },
            { apiName: 'LastName', required: true },
            { apiName: 'Company', required: true }
        ]);

        expect(
            createFallbackFormSections({
                objectApiName: 'Case',
                nameFieldApiName: 'Subject'
            })[0].fields
        ).toEqual([{ apiName: 'Subject', required: true }]);
    });
});
