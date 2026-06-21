import { createElement } from 'lwc';
import ObjectRecordSearch from 'c/objectRecordSearch';
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
        nameFieldUpdateable: true
    },
    records: [
        {
            id: '001xx000003DGbYAAW',
            name: 'Acme',
            recordUrl: '/lightning/r/Account/001xx000003DGbYAAW/view',
            createdDate: '2026-06-21T00:00:00.000Z',
            lastModifiedDate: '2026-06-21T01:00:00.000Z'
        }
    ],
    limitSize: 200
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
        await expect(element).toBeAccessible();
    });

    it('deletes selected rows through Apex', async () => {
        const element = createComponent();
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

        const deleteButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === '選択したレコードを削除');
        deleteButton.click();
        await flushPromises();

        expect(deleteRecords).toHaveBeenCalledWith({
            metricKey: 'accounts',
            recordIds: ['001xx000003DGbYAAW']
        });
    });

    it('opens a create form for the target object', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();

        const newButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === '新規');
        newButton.click();
        await flushPromises();

        const form = element.shadowRoot.querySelector(
            'lightning-record-edit-form'
        );
        expect(element.shadowRoot.textContent).toContain('取引先を作成');
        expect(form.objectApiName).toBe('Account');
        expect(form.recordId).toBeUndefined();
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

        const newButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === '新規');
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

        const newButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === '新規');
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

        const newButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === '新規');
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
