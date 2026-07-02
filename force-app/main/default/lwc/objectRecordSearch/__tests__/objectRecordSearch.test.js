import '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchApexMocks';
import { refreshApex } from '@salesforce/apex';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';
import {
    createComponent,
    createSearchResponse,
    findButton,
    flushPromises,
    searchResponse
} from '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchTestUtils';

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
        element.addEventListener('recordschanged', recordsChangedHandler);
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

    it('keeps the record form closed when a non-edit row action is invoked', async () => {
        const element = createComponent();

        searchRecords.emit(searchResponse);
        await flushPromises();

        element.shadowRoot.querySelector('lightning-datatable').dispatchEvent(
            new CustomEvent('rowaction', {
                detail: {
                    action: { name: 'view' },
                    row: searchResponse.records[0]
                }
            })
        );
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('lightning-record-edit-form')
        ).toBeNull();
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

    it('explains access errors detected from an error message', async () => {
        const element = createComponent();

        searchRecords.error(
            { message: 'INSUFFICIENT ACCESS: 参照権限がありません。' },
            500
        );
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('[role="alert"]').textContent
        ).toContain('アクセス権限を確認してください');
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

    it('shows the search-specific empty message after searching', async () => {
        const element = createComponent();

        searchRecords.emit({
            ...searchResponse,
            records: []
        });
        await flushPromises();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.value = 'Missing';
        input.dispatchEvent(new CustomEvent('change'));
        findButton(element, '検索').click();
        searchRecords.emit({
            ...searchResponse,
            records: []
        });
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            '検索条件に一致するレコードが見つかりません。'
        );
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
