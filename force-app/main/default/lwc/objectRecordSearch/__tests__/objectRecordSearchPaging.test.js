import '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchApexMocks';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import {
    createComponent,
    findButton,
    flushPromises,
    searchResponse
} from '../../../../../test/jest-utils/objectRecordSearch/objectRecordSearchTestUtils';

describe('c-object-record-search paging and sorting', () => {
    it('blocks repeated page actions until the response arrives', async () => {
        const element = createComponent();
        searchRecords.emit({ ...searchResponse, hasNextPage: true, nextPageToken: 'page-2' });
        await flushPromises();

        const nextButton = findButton(element, '次へ');
        nextButton.click();
        nextButton.click();
        await flushPromises();

        expect(searchRecords.getLastConfig().request).toMatchObject({ pageNumber: 2, pageToken: 'page-2' });
        expect(findButton(element, '次へ').disabled).toBe(true);
        expect(findButton(element, '前へ').disabled).toBe(true);

        searchRecords.emit({ ...searchResponse, pageNumber: 2, hasNextPage: true, nextPageToken: 'page-3' });
        await flushPromises();
        expect(findButton(element, '次へ').disabled).toBe(false);
        findButton(element, '次へ').click();
        await flushPromises();
        expect(searchRecords.getLastConfig().request).toMatchObject({ pageNumber: 3, pageToken: 'page-3' });
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
});
