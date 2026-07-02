import '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchApexMocks';
import { refreshApex } from '@salesforce/apex';
import { getLayout } from 'lightning/uiLayoutApi';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import {
    createComponent,
    createSearchResponse,
    emitLayout,
    emitObjectInfo,
    findButton,
    flushPromises,
    searchResponse
} from '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchTestUtils';

describe('c-object-record-search form flows', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('opens a create form for the target object', async () => {
        const element = await createRecordFormReadyComponent();

        await openNewRecordForm(element);

        const form = element.shadowRoot.querySelector(
            'lightning-record-edit-form'
        );
        const modal = element.shadowRoot.querySelector('.slds-modal');
        expect(element.shadowRoot.textContent).toContain('取引先を作成');
        expect(modal.classList).toContain('slds-modal_large');
        expect(form.objectApiName).toBe('Account');
        expect(form.recordId).toBeUndefined();
        expect(getInputFieldNames(element)).toEqual(['Name', 'Industry']);
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

        expect(getInputFieldNames(element)).toEqual(['Name', 'Industry']);
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

        expect(getInputFieldNames(element)).toEqual(['Name', 'Industry']);
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

        const fields = getInputFields(element);
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

        findButton(element, '新規').click();
        await flushPromises();

        const fields = getInputFields(element);
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

        findButton(element, '新規').click();
        await flushPromises();

        const fields = getInputFields(element);
        expect(fields.map((field) => field.fieldName)).toEqual([
            'Name',
            'StageName',
            'CloseDate'
        ]);
        expect(fields.every((field) => field.required)).toBe(true);
    });

    it('opens an edit form from the row action', async () => {
        const element = await createRecordFormReadyComponent();

        element.shadowRoot.querySelector('lightning-datatable').dispatchEvent(
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
        const element = await createRecordFormReadyComponent();

        await openNewRecordForm(element);

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

    it('enters saving state when record form validation succeeds', async () => {
        const element = await createRecordFormReadyComponent();

        await openNewRecordForm(element);

        element.shadowRoot
            .querySelectorAll('lightning-input-field')
            .forEach((field) => {
                field.reportValidity = jest.fn().mockReturnValue(true);
            });
        element.shadowRoot
            .querySelector('lightning-record-edit-form')
            .dispatchEvent(new CustomEvent('submit'));
        await flushPromises();

        expect(findButton(element, '保存').disabled).toBe(true);
    });

    it('shows fallback save error when record form save fails without a message', async () => {
        const element = await createRecordFormReadyComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        await openNewRecordForm(element);

        element.shadowRoot
            .querySelector('lightning-record-edit-form')
            .dispatchEvent(new CustomEvent('error'));
        await flushPromises();

        expect(toastHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: expect.objectContaining({
                    title: '保存に失敗しました',
                    message: '取引先を保存できませんでした。',
                    variant: 'error'
                })
            })
        );
    });

    it('refreshes rows and dispatches recordschanged when a form save succeeds', async () => {
        const element = await createRecordFormReadyComponent();
        const recordsChangedHandler = jest.fn();
        const toastHandler = jest.fn();
        element.addEventListener('recordschanged', recordsChangedHandler);
        element.addEventListener('lightning__showtoast', toastHandler);

        await openNewRecordForm(element);

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
});

async function createRecordFormReadyComponent() {
    const element = createComponent();
    searchRecords.emit(searchResponse);
    await flushPromises();
    emitObjectInfo();
    emitLayout();
    await flushPromises();
    return element;
}

async function openNewRecordForm(element) {
    await flushPromises();
    findButton(element, '新規').click();
    await flushPromises();
}

function getInputFieldNames(element) {
    return getInputFields(element).map((field) => field.fieldName);
}

function getInputFields(element) {
    return Array.from(
        element.shadowRoot.querySelectorAll('lightning-input-field')
    );
}
