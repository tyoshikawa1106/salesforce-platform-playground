import { getModal, getModalRoot, mockModalOpen } from '../../../../../test/jest-utils/objectRecordSearch/objectRecordFormModalMock';
import '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchApexMocks';
import { refreshApex } from '@salesforce/apex';
import ObjectRecordFormModal from 'c/objectRecordFormModal';
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
    beforeEach(() => mockModalOpen());
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('作成可能項目がなくても更新可能なレコードを編集できる', async () => {
        const element = createComponent();
        searchRecords.emit(createSearchResponse({ createable: false, updateable: true }));
        await flushPromises();
        emitObjectInfo({ Name: { custom: false, createable: false, updateable: true } });
        await flushPromises();
        emitLayout({ mode: 'Create', fields: [] });
        await flushPromises();
        expect(findButton(element, '新規').disabled).toBe(true);
        let table = element.shadowRoot.querySelector('lightning-datatable');
        expect(table.columns.some((column) => column.type === 'action')).toBe(false);

        emitLayout({ mode: 'Edit', fields: ['Name'] });
        await flushPromises();
        table = element.shadowRoot.querySelector('lightning-datatable');
        expect(table.columns.some((column) => column.type === 'action')).toBe(true);
        table.dispatchEvent(new CustomEvent('rowaction', {
            detail: { action: { name: 'edit' }, row: searchResponse.records[0] }
        }));
        await flushPromises();
        expect(getModalRoot().querySelector('lightning-record-edit-form').recordId)
            .toBe(searchResponse.records[0].id);
        expect(getInputFieldNames()).toContain('Name');
        await expect(element).toBeAccessible();
    });

    it('編集レイアウトに項目がなくても作成操作は有効にする', async () => {
        const element = createComponent();
        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        await flushPromises();
        emitLayout({ mode: 'Create', fields: ['Name'] });
        emitLayout({ mode: 'Edit', fields: [] });
        await flushPromises();
        expect(findButton(element, '新規').disabled).toBe(false);
        const table = element.shadowRoot.querySelector('lightning-datatable');
        expect(table.columns.some((column) => column.type === 'action')).toBe(false);
        findButton(element, '新規').click();
        await flushPromises();
        expect(getInputFieldNames()).toContain('Name');
    });

    it('作成レイアウトの応答前でも編集レイアウトから編集を許可する', async () => {
        const element = createComponent();
        searchRecords.emit(searchResponse);
        await flushPromises();
        emitObjectInfo();
        await flushPromises();
        emitLayout({ mode: 'Edit', fields: ['Name'] });
        await flushPromises();
        expect(findButton(element, '新規').disabled).toBe(true);
        const table = element.shadowRoot.querySelector('lightning-datatable');
        expect(table.columns.some((column) => column.type === 'action')).toBe(true);
        emitLayout({ mode: 'Create', fields: [] });
        await flushPromises();
        expect(table.columns.some((column) => column.type === 'action')).toBe(true);
    });

    it('opens a create form for the target object', async () => {
        const element = await createRecordFormReadyComponent();

        await openNewRecordForm(element);

        const form = getModalRoot().querySelector(
            'lightning-record-edit-form'
        );
        const modal = getModal();
        expect(getModal().label).toBe('取引先を作成');
        expect(modal.dataset.size).toBe('large');
        expect(form.objectApiName).toBe('Account');
        expect(form.recordId).toBeUndefined();
        expect(getInputFieldNames()).toEqual(['Name', 'Industry']);
        await expect(element).toBeAccessible();
    });

    it('重複起動を防ぎ、キャンセル後は一覧を更新せず新しいモーダルを開ける', async () => {
        const element = await createRecordFormReadyComponent();
        await openNewRecordForm(element);
        const firstModal = getModal();
        findButton(element, '新規').click();
        expect(ObjectRecordFormModal.open).toHaveBeenCalledTimes(1);
        firstModal.close();
        await flushPromises();
        expect(refreshApex).not.toHaveBeenCalled();
        expect(getModal()).toBeNull();
        await openNewRecordForm(element);
        expect(ObjectRecordFormModal.open).toHaveBeenCalledTimes(2);
        expect(getModal()).not.toBe(firstModal);
    });

    it('モーダルの起動失敗を通知して再試行できる', async () => {
        const element = await createRecordFormReadyComponent();
        const toast = jest.fn();
        element.addEventListener('lightning__showtoast', toast);
        ObjectRecordFormModal.open.mockRejectedValueOnce(new Error('起動失敗'));
        await openNewRecordForm(element);
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            detail: expect.objectContaining({ title: 'フォームを開けませんでした', variant: 'error' })
        }));
        await openNewRecordForm(element);
        expect(getModal()).not.toBeNull();
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

        expect(getInputFieldNames()).toEqual(['Name', 'Industry']);
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

        const sections = getModalRoot().querySelectorAll('.form-section');
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

        expect(getInputFieldNames()).toEqual(['Name', 'Industry']);
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

        const fields = getInputFields();
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

        const fields = getInputFields();
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

        const fields = getInputFields();
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

        const form = getModalRoot().querySelector(
            'lightning-record-edit-form'
        );
        expect(getModal().label).toBe('取引先を編集');
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

        const upload = getModalRoot().querySelector(
            'lightning-file-upload'
        );
        expect(upload).not.toBeNull();
        expect(getModal().label).toBe(
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

        getModalRoot().querySelector(
            'lightning-input-field'
        ).reportValidity = jest.fn().mockReturnValue(false);
        const submitEvent = new CustomEvent('submit', { cancelable: true });
        submitEvent.preventDefault = jest.fn();
        getModalRoot()
            .querySelector('lightning-record-edit-form')
            .dispatchEvent(submitEvent);

        expect(submitEvent.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('enters saving state when record form validation succeeds', async () => {
        const element = await createRecordFormReadyComponent();

        await openNewRecordForm(element);

        getModalRoot()
            .querySelectorAll('lightning-input-field')
            .forEach((field) => {
                field.reportValidity = jest.fn().mockReturnValue(true);
            });
        getModalRoot()
            .querySelector('lightning-record-edit-form')
            .dispatchEvent(new CustomEvent('submit'));
        await flushPromises();

        expect(findButton(getModal(), '保存').disabled).toBe(true);
        expect(getModal().disableClose).toBe(true);
        const duplicateSubmit = new CustomEvent('submit', { cancelable: true });
        getModalRoot().querySelector('lightning-record-edit-form').dispatchEvent(duplicateSubmit);
        expect(duplicateSubmit.defaultPrevented).toBe(true);
    });

    it('保存中は標準モーダルを閉じられず、エラー後は再び閉じられる', async () => {
        const element = await createRecordFormReadyComponent();
        await openNewRecordForm(element);
        getModalRoot().querySelectorAll('lightning-input-field').forEach((field) => {
            field.reportValidity = jest.fn().mockReturnValue(true);
        });
        const form = getModalRoot().querySelector('lightning-record-edit-form');
        form.dispatchEvent(new CustomEvent('submit'));
        await flushPromises();

        const modal = getModal();
        expect(modal.disableClose).toBe(true);
        findButton(modal, 'キャンセル').click();
        modal.close();
        await flushPromises();
        expect(getModalRoot().querySelector('lightning-record-edit-form')).toBe(form);

        form.dispatchEvent(new CustomEvent('error', { detail: { message: '保存失敗' } }));
        await flushPromises();
        expect(modal.disableClose).toBe(false);
        findButton(modal, 'キャンセル').click();
        await flushPromises();
        expect(getModal()).toBeNull();
    });

    it('保存エラーにメッセージがない場合はフォーム内に代替案内を表示する', async () => {
        const element = await createRecordFormReadyComponent();
        await openNewRecordForm(element);
        getModalRoot().querySelector('lightning-record-edit-form').dispatchEvent(new CustomEvent('error'));
        await flushPromises();
        expect(getModalRoot().querySelector('[role="alert"]').textContent).toBe('取引先を保存できませんでした。');
        expect(getModal().disableClose).toBe(false);
    });

    it('refreshes rows and dispatches recordschanged when a form save succeeds', async () => {
        const element = await createRecordFormReadyComponent();
        const recordsChangedHandler = jest.fn();
        const toastHandler = jest.fn();
        element.addEventListener('recordschanged', recordsChangedHandler);
        element.addEventListener('lightning__showtoast', toastHandler);

        await openNewRecordForm(element);

        getModalRoot()
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
        expect(getModal()).toBeNull();
    });
    it.each(['save', 'upload'])('%s成功後の取得失敗でも成功通知と親通知を維持する', async (operation) => {
        const element = operation === 'save' ? await createRecordFormReadyComponent() : createComponent();
        const changed = jest.fn();
        const toast = jest.fn();
        element.addEventListener('recordschanged', changed);
        element.addEventListener('lightning__showtoast', toast);
        refreshApex.mockRejectedValueOnce(new Error('一覧の再取得に失敗'));
        if (operation === 'save') {
            await openNewRecordForm(element);
            getModalRoot().querySelector('lightning-record-edit-form').dispatchEvent(new CustomEvent('success'));
        } else {
            searchRecords.emit(createSearchResponse({ metricKey: 'files', objectApiName: 'ContentDocument', objectLabel: 'ファイル' }));
            await flushPromises();
            findButton(element, 'アップロード').click();
            await flushPromises();
            getModalRoot().querySelector('lightning-file-upload').dispatchEvent(
                new CustomEvent('uploadfinished', { detail: { files: [{ name: 'sample.pdf' }] } })
            );
        }
        await flushPromises();
        await flushPromises();
        expect(changed).toHaveBeenCalledTimes(1);
        expect(toast.mock.calls.map(([event]) => event.detail.variant)).toEqual(['success']);
        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('再取得');
        expect(getModal()).toBeNull();
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

function getInputFieldNames() {
    return getInputFields().map((field) => field.fieldName);
}

function getInputFields() {
    return Array.from(
        getModalRoot().querySelectorAll('lightning-input-field')
    );
}
