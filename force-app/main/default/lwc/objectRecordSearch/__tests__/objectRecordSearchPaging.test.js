import '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchApexMocks';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import { refreshApex } from '@salesforce/apex';
import {
    createComponent,
    findButton,
    flushPromises,
    searchResponse
} from '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchTestUtils';

describe('c-object-record-search paging and sorting', () => {
    it('refreshes failed new criteria instead of the previous successful search', async () => {
        const element = createComponent();
        searchRecords.emit(searchResponse);
        await flushPromises();
        const input = element.shadowRoot.querySelector('lightning-input');
        input.value = 'Other';
        input.dispatchEvent(new CustomEvent('change'));
        findButton(element, '検索').click();
        await flushPromises();
        searchRecords.error({ message: '新しい条件の検索に失敗' });
        await flushPromises();

        element.shadowRoot.querySelector('lightning-button-icon[title="再読み込み"]').click();
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.objectContaining({ body: { message: '新しい条件の検索に失敗' } })
        }));
        expect(searchRecords.getLastConfig().request.searchTerm).toBe('Other');
    });

    it('unlocks retry when refreshing a later page fails', async () => {
        const element = createComponent();
        searchRecords.emit({ ...searchResponse, hasNextPage: true, paginationCursor: 'old-cursor', nextIndex: 50 });
        await flushPromises();
        findButton(element, '次へ').click();
        await flushPromises();
        searchRecords.emit({ ...searchResponse, pageNumber: 2, hasNextPage: false });
        await flushPromises();
        refreshApex.mockRejectedValueOnce(new Error('再取得エラー'));
        const button = element.shadowRoot.querySelector('lightning-button-icon[title="再読み込み"]');
        button.click();
        await flushPromises();

        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('再取得エラー');
        expect(button.disabled).toBe(false);
        expect(findButton(element, '検索').disabled).toBe(false);
        await expect(element).toBeAccessible();
        button.click();
        await flushPromises();
        expect(refreshApex).toHaveBeenCalledTimes(2);
    });

    it.each(['search', 'sort'])('preserves the next page after unchanged %s criteria', async (action) => {
        const element = createComponent();
        searchRecords.emit({ ...searchResponse, hasNextPage: true, paginationCursor: 'standard-cursor', nextIndex: 50 });
        await flushPromises();

        if (action === 'search') {
            findButton(element, '検索').click();
        } else {
            element.shadowRoot.querySelector('lightning-datatable').dispatchEvent(
                new CustomEvent('sort', { detail: { fieldName: 'recordUrl', sortDirection: 'asc' } })
            );
        }
        await flushPromises();

        expect(findButton(element, '次へ').disabled).toBe(false);
        expect(element.shadowRoot.querySelector('lightning-datatable').isLoading).toBe(false);
        findButton(element, '次へ').click();
        await flushPromises();
        expect(searchRecords.getLastConfig().request).toMatchObject({ pageNumber: 2, paginationCursor: 'standard-cursor', startIndex: 50 });
    });

    it('blocks repeated page actions until the response arrives', async () => {
        const element = createComponent();
        searchRecords.emit({ ...searchResponse, hasNextPage: true, paginationCursor: 'standard-cursor', nextIndex: 50 });
        await flushPromises();

        const nextButton = findButton(element, '次へ');
        nextButton.click();
        nextButton.click();
        await flushPromises();

        expect(searchRecords.getLastConfig().request).toMatchObject({ pageNumber: 2, paginationCursor: 'standard-cursor', startIndex: 50 });
        expect(findButton(element, '次へ').disabled).toBe(true);
        expect(findButton(element, '前へ').disabled).toBe(true);

        searchRecords.emit({ ...searchResponse, pageNumber: 2, hasNextPage: true, paginationCursor: 'standard-cursor', nextIndex: 100 });
        await flushPromises();
        expect(findButton(element, '次へ').disabled).toBe(false);
        findButton(element, '次へ').click();
        await flushPromises();
        expect(searchRecords.getLastConfig().request).toMatchObject({ pageNumber: 3, paginationCursor: 'standard-cursor', startIndex: 100 });
    });

    it('allows retry after a failed search without waiting on unchanged criteria', async () => {
        const element = createComponent();
        searchRecords.emit(searchResponse);
        await flushPromises();
        const input = element.shadowRoot.querySelector('lightning-input');
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-datatable').isLoading).toBe(false);

        input.value = 'Acme';
        input.dispatchEvent(new CustomEvent('change'));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-datatable').isLoading).toBe(true);
        searchRecords.error({ message: '検索に失敗しました' });
        await flushPromises();

        input.value = 'Other';
        input.dispatchEvent(new CustomEvent('change'));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
        await flushPromises();
        expect(searchRecords.getLastConfig().request.searchTerm).toBe('Other');
        searchRecords.emit(searchResponse);
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-datatable').isLoading).toBe(false);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
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
                paginationCursor: null, startIndex: 0,
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
                paginationCursor: null, startIndex: 0,
                sortBy: 'Industry',
                sortDirection: 'desc',
                pageNumber: 1
            }
        });
    });

    it('discards the old cursor when refreshing a later page', async () => {
        const element = createComponent();
        searchRecords.emit({ ...searchResponse, hasNextPage: true, paginationCursor: 'standard-cursor', nextIndex: 50 });
        await flushPromises();
        findButton(element, '次へ').click();
        await flushPromises();
        searchRecords.emit({ ...searchResponse, pageNumber: 2, hasNextPage: false, paginationCursor: 'standard-cursor', nextIndex: 100 });
        await flushPromises();
        element.shadowRoot.querySelector('lightning-button-icon[title="再読み込み"]').click();
        await flushPromises();
        expect(searchRecords.getLastConfig().request).toMatchObject({ paginationCursor: null, startIndex: 0, pageNumber: 1 });
    });

    it('shows an explicit notice when the result reaches the display limit', async () => {
        const element = createComponent();
        searchRecords.emit({ ...searchResponse, isResultLimitReached: true });
        await flushPromises();
        expect(element.shadowRoot.textContent).toContain('表示上限の100,000件');
        searchRecords.emit({ ...searchResponse, isResultLimitReached: false });
        await flushPromises();
        expect(element.shadowRoot.textContent).not.toContain('表示上限の100,000件');
    });

    it('moves between server-side result pages', async () => {
        const element = createComponent();

        searchRecords.emit({
            ...searchResponse,
            hasNextPage: true,
            paginationCursor: 'standard-cursor', nextIndex: 50
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
                paginationCursor: 'standard-cursor', startIndex: 50,
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
            paginationCursor: 'standard-cursor', nextIndex: 0
        });
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('現在のページ: 2');

        findButton(element, '前へ').click();
        await flushPromises();

        expect(searchRecords.getLastConfig()).toEqual({
            request: {
                metricKey: 'accounts',
                searchTerm: '',
                paginationCursor: null, startIndex: 0,
                sortBy: 'Name',
                sortDirection: 'asc',
                pageNumber: 1
            }
        });
    });
});
