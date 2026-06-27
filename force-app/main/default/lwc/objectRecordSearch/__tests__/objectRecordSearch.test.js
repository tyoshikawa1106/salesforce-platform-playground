import { createElement } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import ObjectRecordSearch from 'c/objectRecordSearch';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn()
    }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/ObjectRecordSearchController.searchRecords',
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
    '@salesforce/apex/ObjectRecordSearchController.deleteRecords',
    () => ({
        default: jest.fn()
    }),
    { virtual: true }
);

const searchResponse = {
    config: {
        metricKey: 'accounts',
        objectApiName: 'Account',
        objectLabel: '取引先',
        nameFieldApiName: 'Name',
        nameFieldLabel: '取引先名',
        deletable: true,
        createable: true,
        updateable: true,
        searchable: true,
        nameFieldCreateable: true,
        nameFieldUpdateable: true,
        displayFields: [
            { apiName: 'Industry', label: '業種' },
            { apiName: 'Type', label: '種別' },
            { apiName: 'Website', label: 'Webサイト' },
            { apiName: 'Phone', label: '電話' },
            { apiName: 'BillingState', label: '都道府県' },
            { apiName: 'BillingCity', label: '市区郡' }
        ]
    },
    records: [
        {
            id: '001xx000003DGbYAAW',
            name: 'Acme',
            recordUrl: '/lightning/r/Account/001xx000003DGbYAAW/view',
            fieldValues: {
                Industry: 'Technology',
                Type: 'Prospect',
                Website: 'https://example.com',
                Phone: '03-5555-0001',
                BillingState: '東京都',
                BillingCity: '千代田区'
            }
        }
    ],
    pageSize: 50,
    pageNumber: 1,
    hasNextPage: false,
    nextPageToken: null
};

function createSearchResponse(configOverrides = {}) {
    return {
        ...searchResponse,
        config: {
            ...searchResponse.config,
            ...configOverrides
        }
    };
}

function createComponent() {
    const element = createElement('c-object-record-search', {
        is: ObjectRecordSearch
    });
    element.metricKey = 'accounts';
    document.body.appendChild(element);
    return element;
}

async function flushPromises() {
    await Promise.resolve();
}

function emitObjectInfo(fieldOverrides = {}) {
    getObjectInfo.emit({
        defaultRecordTypeId: '012000000000000AAA',
        fields: {
            Name: createFieldInfo(),
            Industry: createFieldInfo(),
            FirstName: createFieldInfo(),
            LastName: createFieldInfo(),
            Company: createFieldInfo(),
            StageName: createFieldInfo(),
            CloseDate: createFieldInfo(),
            Custom_Text__c: createFieldInfo({ custom: true }),
            ...fieldOverrides
        }
    });
}

function createFieldInfo(overrides = {}) {
    return {
        custom: false,
        createable: true,
        updateable: true,
        ...overrides
    };
}

function emitLayout({
    objectApiName = 'Account',
    mode = 'Create',
    fields = ['Name', 'Industry'],
    sections
} = {}) {
    const layoutSections = (sections ?? [{ heading: '基本情報', fields }]).map(
        (section) => ({
            heading: section.heading,
            layoutRows: [
                {
                    layoutItems: section.fields.map((field) => ({
                        editableForNew: true,
                        editableForUpdate: true,
                        required: true,
                        layoutComponents: [
                            {
                                apiName: field,
                                componentType: 'Field'
                            }
                        ]
                    }))
                }
            ]
        })
    );

    getLayout.emit({
        layouts: {
            [objectApiName]: {
                Full: {
                    [mode]: {
                        sections: layoutSections
                    }
                }
            }
        }
    });
}

function findButton(element, label) {
    return Array.from(
        element.shadowRoot.querySelectorAll('lightning-button')
    ).find((button) => button.label === label);
}

describe('c-object-record-search', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders searched records with a standard record URL', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();

        const datatable = element.shadowRoot.querySelector(
            'lightning-datatable'
        );
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe(
            '取引先 一覧'
        );
        expect(datatable.data).toHaveLength(1);
        expect(datatable.data[0].recordUrl).toBe(
            '/lightning/r/Account/001xx000003DGbYAAW/view'
        );
        expect(datatable.columns[0].label).toBe('取引先名');
        expect(datatable.columns[0].sortable).toBe(true);
        expect(datatable.columns.map((column) => column.label)).toEqual([
            '取引先名',
            '業種',
            '種別',
            'Webサイト',
            '電話',
            '都道府県',
            '市区郡'
        ]);
        expect(datatable.columns.map((column) => column.type)).toEqual([
            'url',
            'text',
            'text',
            'url',
            'phone',
            'text',
            'text'
        ]);
        expect(datatable.columns[3].typeAttributes).toEqual({
            label: { fieldName: 'displayField_Website' },
            target: '_blank'
        });
        expect(datatable.data[0].displayField_Industry).toBe('Technology');
        expect(datatable.data[0].displayField_Type).toBe('Prospect');
        expect(datatable.data[0].displayField_Website).toBe(
            'https://example.com'
        );
        expect(datatable.data[0].displayField_Phone).toBe('03-5555-0001');
        expect(datatable.data[0].displayField_BillingState).toBe('東京都');
        expect(datatable.data[0].displayField_BillingCity).toBe('千代田区');
        await expect(element).toBeAccessible();
    });

    it('deletes selected rows through Apex', async () => {
        const element = createComponent();
        const recordsChangedHandler = jest.fn();
        const recordsDeletedHandler = jest.fn();
        element.addEventListener('recordschanged', recordsChangedHandler);
        element.addEventListener('recordsdeleted', recordsDeletedHandler);
        deleteRecords.mockResolvedValue({
            requestedCount: 1,
            deletedCount: 1,
            errors: []
        });

        searchRecords.emit(searchResponse);
        await flushPromises();

        const datatable = element.shadowRoot.querySelector(
            'lightning-datatable'
        );
        datatable.dispatchEvent(
            new CustomEvent('rowselection', {
                detail: { selectedRows: [searchResponse.records[0]] }
            })
        );
        await flushPromises();

        const deleteButton = findButton(element, '選択したレコードを削除');
        deleteButton.click();
        await flushPromises();

        expect(deleteRecords).toHaveBeenCalledWith({
            metricKey: 'accounts',
            recordIds: ['001xx000003DGbYAAW']
        });
        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(recordsChangedHandler).toHaveBeenCalledTimes(1);
        expect(recordsDeletedHandler).not.toHaveBeenCalled();
    });

    it('shows a warning toast when Apex returns partial delete errors', async () => {
        const element = createComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        deleteRecords.mockResolvedValue({
            requestedCount: 2,
            deletedCount: 1,
            errors: ['1 件は削除できませんでした。']
        });

        searchRecords.emit(searchResponse);
        await flushPromises();

        element.shadowRoot.querySelector('lightning-datatable').dispatchEvent(
            new CustomEvent('rowselection', {
                detail: { selectedRows: [searchResponse.records[0]] }
            })
        );
        findButton(element, '選択したレコードを削除').click();
        await flushPromises();

        expect(toastHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    title: '一部削除できませんでした',
                    message: '1 件は削除できませんでした。',
                    variant: 'warning'
                })
            })
        );
    });

    it('shows an error when delete fails', async () => {
        const element = createComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        deleteRecords.mockRejectedValue({
            body: { message: '削除できませんでした。' }
        });

        searchRecords.emit(searchResponse);
        await flushPromises();

        element.shadowRoot.querySelector('lightning-datatable').dispatchEvent(
            new CustomEvent('rowselection', {
                detail: { selectedRows: [searchResponse.records[0]] }
            })
        );
        findButton(element, '選択したレコードを削除').click();
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('[role="alert"]').textContent
        ).toContain('削除できませんでした。');
        expect(toastHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    title: '削除に失敗しました',
                    variant: 'error'
                })
            })
        );
    });

    it('explains when the record list cannot be loaded because of access', async () => {
        const element = createComponent();

        searchRecords.error(
            { message: 'insufficient access: 参照権限がありません。' },
            403
        );
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert.textContent).toContain(
            'アクセス権限を確認してください'
        );
        expect(alert.textContent).toContain('参照権限がありません。');
        await expect(element).toBeAccessible();
    });

    it('shows unavailable actions when object permissions are missing', async () => {
        const element = createComponent();

        searchRecords.emit(
            createSearchResponse({
                createable: false,
                updateable: false,
                deletable: false
            })
        );
        await flushPromises();

        const text = element.shadowRoot.textContent;
        expect(findButton(element, '新規').disabled).toBe(true);
        expect(findButton(element, '選択したレコードを削除').disabled).toBe(
            true
        );
        expect(text).toContain('取引先を作成する権限がありません。');
        expect(text).toContain('取引先を編集する権限がありません。');
        expect(text).toContain('取引先を削除する権限がありません。');
        expect(
            element.shadowRoot.querySelector('lightning-datatable').columns
        ).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'action'
                })
            ])
        );
        await expect(element).toBeAccessible();
    });

    it('opens a create form for the target object', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        emitLayout();
        await flushPromises();

        const newButton = findButton(element, '新規');
        newButton.click();
        await flushPromises();

        const form = element.shadowRoot.querySelector(
            'lightning-record-edit-form'
        );
        const modal = element.shadowRoot.querySelector('.slds-modal');
        expect(element.shadowRoot.textContent).toContain('取引先を作成');
        expect(modal.classList).toContain('slds-modal_large');
        expect(form.objectApiName).toBe('Account');
        expect(form.recordId).toBeUndefined();
        expect(
            Array.from(
                element.shadowRoot.querySelectorAll('lightning-input-field')
            ).map((field) => field.fieldName)
        ).toEqual(['Name', 'Industry']);
        await expect(element).toBeAccessible();
    });

    it('explains layout fallback when the page layout cannot be loaded', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        getLayout.error({
            status: 403,
            body: { message: 'ページレイアウトを取得できません。' }
        });
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'ページレイアウトを取得できないため、標準の入力項目で表示します。'
        );

        findButton(element, '新規').click();
        await flushPromises();

        expect(
            Array.from(
                element.shadowRoot.querySelectorAll('lightning-input-field')
            ).map((field) => field.fieldName)
        ).toEqual(['Name', 'Industry']);
    });

    it('groups record form fields by layout section', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        emitLayout({
            sections: [
                { heading: '基本情報', fields: ['Name'] },
                { heading: '追加情報', fields: ['Industry'] }
            ]
        });
        await flushPromises();

        findButton(element, '新規').click();
        await flushPromises();

        const sections = element.shadowRoot.querySelectorAll('.form-section');
        expect(sections).toHaveLength(2);
        expect(sections[0].textContent).toContain('基本情報');
        expect(sections[1].textContent).toContain('追加情報');
        expect(
            sections[0].querySelector('lightning-input-field').fieldName
        ).toBe('Name');
        expect(
            sections[1].querySelector('lightning-input-field').fieldName
        ).toBe('Industry');
    });

    it('uses editable standard fields from the page layout and skips custom fields', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        emitLayout({ fields: ['Name', 'Industry', 'Custom_Text__c'] });
        await flushPromises();

        findButton(element, '新規').click();
        await flushPromises();

        expect(
            Array.from(
                element.shadowRoot.querySelectorAll('lightning-input-field')
            ).map((field) => field.fieldName)
        ).toEqual(['Name', 'Industry']);
    });

    it('renders split required name fields for contacts', async () => {
        const element = createComponent();

        searchRecords.emit(
            createSearchResponse({
                metricKey: 'contacts',
                objectApiName: 'Contact',
                objectLabel: '取引先責任者',
                nameFieldCreateable: false,
                nameFieldUpdateable: false
            })
        );
        await flushPromises();
        emitObjectInfo();
        emitLayout({
            objectApiName: 'Contact',
            fields: ['FirstName', 'LastName']
        });
        await flushPromises();

        const newButton = findButton(element, '新規');
        expect(newButton.disabled).toBe(false);
        newButton.click();
        await flushPromises();

        const fields = Array.from(
            element.shadowRoot.querySelectorAll('lightning-input-field')
        );
        expect(fields.map((field) => field.fieldName)).toEqual([
            'FirstName',
            'LastName'
        ]);
        expect(fields.every((field) => field.required)).toBe(true);
    });

    it('renders required lead fields including company', async () => {
        const element = createComponent();

        searchRecords.emit(
            createSearchResponse({
                metricKey: 'leads',
                objectApiName: 'Lead',
                objectLabel: 'リード',
                nameFieldCreateable: false,
                nameFieldUpdateable: false
            })
        );
        await flushPromises();
        emitObjectInfo();
        emitLayout({
            objectApiName: 'Lead',
            fields: ['FirstName', 'LastName', 'Company']
        });
        await flushPromises();

        const newButton = findButton(element, '新規');
        newButton.click();
        await flushPromises();

        const fields = Array.from(
            element.shadowRoot.querySelectorAll('lightning-input-field')
        );
        expect(fields.map((field) => field.fieldName)).toEqual([
            'FirstName',
            'LastName',
            'Company'
        ]);
        expect(fields.every((field) => field.required)).toBe(true);
    });

    it('renders required opportunity fields that are needed to save', async () => {
        const element = createComponent();

        searchRecords.emit(
            createSearchResponse({
                metricKey: 'opportunities',
                objectApiName: 'Opportunity',
                objectLabel: '商談'
            })
        );
        await flushPromises();
        emitObjectInfo();
        emitLayout({
            objectApiName: 'Opportunity',
            fields: ['Name', 'StageName', 'CloseDate']
        });
        await flushPromises();

        const newButton = findButton(element, '新規');
        newButton.click();
        await flushPromises();

        const fields = Array.from(
            element.shadowRoot.querySelectorAll('lightning-input-field')
        );
        expect(fields.map((field) => field.fieldName)).toEqual([
            'Name',
            'StageName',
            'CloseDate'
        ]);
        expect(fields.every((field) => field.required)).toBe(true);
    });

    it('opens an edit form from the row action', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        emitLayout();
        await flushPromises();

        const datatable = element.shadowRoot.querySelector(
            'lightning-datatable'
        );
        datatable.dispatchEvent(
            new CustomEvent('rowaction', {
                detail: {
                    action: { name: 'edit' },
                    row: searchResponse.records[0]
                }
            })
        );
        await flushPromises();

        const form = element.shadowRoot.querySelector(
            'lightning-record-edit-form'
        );
        expect(element.shadowRoot.textContent).toContain('取引先を編集');
        expect(form.recordId).toBe('001xx000003DGbYAAW');
    });

    it('does not open create or edit forms for email messages', async () => {
        const element = createComponent();

        searchRecords.emit(
            createSearchResponse({
                metricKey: 'emailMessages',
                objectApiName: 'EmailMessage',
                objectLabel: 'メールメッセージ'
            })
        );
        await flushPromises();

        expect(findButton(element, '新規').disabled).toBe(true);
        expect(element.shadowRoot.textContent).toContain(
            'メールメッセージは汎用フォームの対象外です。'
        );
        expect(
            element.shadowRoot.querySelector('lightning-datatable').columns
        ).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'action'
                })
            ])
        );
    });

    it('opens a file upload dialog for files and refreshes after upload', async () => {
        const element = createComponent();
        const recordsChangedHandler = jest.fn();
        const toastHandler = jest.fn();
        element.addEventListener('recordschanged', recordsChangedHandler);
        element.addEventListener('lightning__showtoast', toastHandler);

        searchRecords.emit(
            createSearchResponse({
                metricKey: 'files',
                objectApiName: 'ContentDocument',
                objectLabel: 'ファイル',
                createable: false,
                updateable: false
            })
        );
        await flushPromises();

        findButton(element, 'アップロード').click();
        await flushPromises();

        const upload = element.shadowRoot.querySelector(
            'lightning-file-upload'
        );
        expect(upload).not.toBeNull();
        expect(element.shadowRoot.textContent).toContain(
            'ファイルをアップロード'
        );
        expect(element.shadowRoot.textContent).toContain(
            'ファイルはアップロードで新規登録します。'
        );
        await expect(element).toBeAccessible();

        upload.dispatchEvent(
            new CustomEvent('uploadfinished', {
                detail: {
                    files: [{ name: 'proposal.pdf' }]
                }
            })
        );
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(recordsChangedHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    title: 'アップロードしました',
                    message: '1 件のファイルを登録しました。',
                    variant: 'success'
                })
            })
        );
    });

    it('prevents record form submit when field validation fails', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        emitLayout();
        await flushPromises();

        findButton(element, '新規').click();
        await flushPromises();

        element.shadowRoot.querySelector(
            'lightning-input-field'
        ).reportValidity = jest.fn().mockReturnValue(false);
        const submitEvent = new CustomEvent('submit', { cancelable: true });
        submitEvent.preventDefault = jest.fn();
        element.shadowRoot
            .querySelector('lightning-record-edit-form')
            .dispatchEvent(submitEvent);

        expect(submitEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('refreshes rows and dispatches recordschanged when a form save succeeds', async () => {
        const element = createComponent();
        const recordsChangedHandler = jest.fn();
        const toastHandler = jest.fn();
        element.addEventListener('recordschanged', recordsChangedHandler);
        element.addEventListener('lightning__showtoast', toastHandler);

        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        emitLayout();
        await flushPromises();

        findButton(element, '新規').click();
        await flushPromises();

        element.shadowRoot
            .querySelector('lightning-record-edit-form')
            .dispatchEvent(new CustomEvent('success'));
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(recordsChangedHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    title: '作成しました',
                    variant: 'success'
                })
            })
        );
        expect(
            element.shadowRoot.querySelector('lightning-record-edit-form')
        ).toBeNull();
    });

    it('runs search when Enter is pressed in the search box', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.value = '  Acme  ';
        input.dispatchEvent(new CustomEvent('change'));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
        await flushPromises();

        expect(searchRecords.getLastConfig()).toEqual({
            request: {
                metricKey: 'accounts',
                searchTerm: 'Acme',
                pageToken: undefined,
                sortBy: 'Name',
                sortDirection: 'asc',
                pageNumber: 1
            }
        });
    });

    it('requests server-side sorting when a table header is clicked', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();

        const datatable = element.shadowRoot.querySelector(
            'lightning-datatable'
        );
        datatable.dispatchEvent(
            new CustomEvent('sort', {
                detail: {
                    fieldName: 'displayField_Industry',
                    sortDirection: 'desc'
                }
            })
        );
        await flushPromises();

        expect(datatable.sortedBy).toBe('displayField_Industry');
        expect(datatable.sortedDirection).toBe('desc');
        expect(searchRecords.getLastConfig()).toEqual({
            request: {
                metricKey: 'accounts',
                searchTerm: '',
                pageToken: undefined,
                sortBy: 'Industry',
                sortDirection: 'desc',
                pageNumber: 1
            }
        });
    });

    it('moves between server-side result pages', async () => {
        const element = createComponent();

        searchRecords.emit({
            ...searchResponse,
            hasNextPage: true,
            nextPageToken: 'next-token'
        });
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('現在のページ: 1');
        expect(element.shadowRoot.textContent).not.toContain('1 / 50 件');

        findButton(element, '次へ').click();
        await flushPromises();

        expect(searchRecords.getLastConfig()).toEqual({
            request: {
                metricKey: 'accounts',
                searchTerm: '',
                pageToken: 'next-token',
                sortBy: 'Name',
                sortDirection: 'asc',
                pageNumber: 2
            }
        });

        searchRecords.emit({
            ...searchResponse,
            records: [],
            pageNumber: 2,
            hasNextPage: false,
            nextPageToken: null
        });
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('現在のページ: 2');

        findButton(element, '前へ').click();
        await flushPromises();

        expect(searchRecords.getLastConfig()).toEqual({
            request: {
                metricKey: 'accounts',
                searchTerm: '',
                pageToken: undefined,
                sortBy: 'Name',
                sortDirection: 'asc',
                pageNumber: 1
            }
        });
    });

    it('refreshes the current wire result from the refresh action', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();

        element.shadowRoot
            .querySelector('lightning-button-icon[title="再読み込み"]')
            .click();
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
    });

    it('dispatches back when the back action is clicked', async () => {
        const element = createComponent();
        const backHandler = jest.fn();
        element.addEventListener('back', backHandler);

        searchRecords.emit(searchResponse);
        await flushPromises();

        element.shadowRoot
            .querySelector('lightning-button-icon[title="データボードに戻る"]')
            .click();

        expect(backHandler).toHaveBeenCalledTimes(1);
    });
});
