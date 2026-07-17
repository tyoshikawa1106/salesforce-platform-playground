import { createElement } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import CaseRelatedCaseList from 'c/caseRelatedCaseList';

const CASE_RECORD_ID = '500000000000001AAA';
const CONTACT_RECORD_ID = '003000000000001AAA';
const ACCOUNT_RECORD_ID = '001000000000001AAA';

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const createComponent = () => {
    const element = createElement('c-case-related-case-list', {
        is: CaseRelatedCaseList
    });
    element.recordId = CASE_RECORD_ID;
    document.body.appendChild(element);
    return element;
};

const createCaseRecord = ({
    contactId = CONTACT_RECORD_ID,
    accountId = ACCOUNT_RECORD_ID
} = {}) => ({
    apiName: 'Case',
    fields: {
        Id: { value: CASE_RECORD_ID },
        ContactId: { value: contactId },
        AccountId: { value: accountId }
    },
    id: CASE_RECORD_ID
});

const createRelatedCase = ({
    id,
    caseNumber,
    subject = 'ログイン方法を確認したい',
    status = '新規',
    lastModifiedDate = '2026-07-17T01:30:00.000Z'
}) => ({
    apiName: 'Case',
    fields: {
        CaseNumber: { value: caseNumber },
        Subject: { value: subject },
        Status: { value: status },
        LastModifiedDate: { value: lastModifiedDate }
    },
    id
});

const emitRelatedCases = (parentRecordId, records) => {
    getRelatedListRecords.emit(
        {
            count: records.length,
            currentPageToken: null,
            nextPageToken: null,
            records
        },
        (config) => config.parentRecordId === parentRecordId
    );
};

const getTabElements = (tab) =>
    tab.shadowRoot
        .querySelector('slot')
        .assignedElements({ flatten: true });

const getTabTiles = (tab) =>
    getTabElements(tab).flatMap((element) => [
        ...(element.matches('lightning-tile') ? [element] : []),
        ...element.querySelectorAll('lightning-tile')
    ]);

const getTabText = (tab) =>
    getTabElements(tab)
        .map((element) => element.textContent)
        .join(' ');

describe('c-case-related-case-list', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders the loading state before the case wire responds', async () => {
        const element = createComponent();
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('lightning-spinner')
        ).not.toBeNull();
        expect(element.shadowRoot.querySelector('lightning-tabset')).toBeNull();
    });

    it('renders contact and account cases in separate tabs', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord());
        await flushPromises();
        expect(getRelatedListRecords.getLastConfig()).toEqual(
            expect.objectContaining({
                pageSize: 6,
                parentRecordId: ACCOUNT_RECORD_ID,
                relatedListId: 'Cases',
                sortBy: ['-Case.LastModifiedDate']
            })
        );
        emitRelatedCases(CONTACT_RECORD_ID, [
            createRelatedCase({
                id: CASE_RECORD_ID,
                caseNumber: '00001000'
            }),
            createRelatedCase({
                id: '500000000000002AAA',
                caseNumber: '00001001'
            }),
            createRelatedCase({
                id: '500000000000003AAA',
                caseNumber: '00001002'
            })
        ]);
        emitRelatedCases(ACCOUNT_RECORD_ID, [
            createRelatedCase({
                id: '500000000000004AAA',
                caseNumber: '00002001',
                subject: '契約内容を確認したい',
                status: '対応中'
            })
        ]);
        await flushPromises();

        const tabs = element.shadowRoot.querySelectorAll('lightning-tab');
        const tiles = [...getTabTiles(tabs[0]), ...getTabTiles(tabs[1])];

        expect([...tabs].map((tab) => tab.label)).toEqual(['顧客', '会社']);
        expect([...tiles].map((tile) => tile.label)).toEqual([
            '00001001',
            '00001002',
            '00002001'
        ]);
        expect([...tiles].every((tile) => tile.href === 'https://www.example.com')).toBe(
            true
        );
        expect(getTabText(tabs[0])).not.toContain('00001000');
        expect(getTabText(tabs[1])).toContain('契約内容を確認したい');
        expect(
            tiles.flatMap((tile) => [
                ...tile.querySelectorAll('lightning-formatted-date-time')
            ])
        ).toHaveLength(3);
        await expect(element).toBeAccessible();
    });

    it('limits each tab to five related cases', async () => {
        const element = createComponent();
        const relatedCases = Array.from({ length: 6 }, (_, index) =>
            createRelatedCase({
                id: `50000000000001${index}AAA`,
                caseNumber: `0000300${index}`
            })
        );

        getRecord.emit(createCaseRecord());
        await flushPromises();
        emitRelatedCases(CONTACT_RECORD_ID, relatedCases);
        await flushPromises();

        const contactTab = element.shadowRoot.querySelectorAll('lightning-tab')[0];

        expect(getTabTiles(contactTab)).toHaveLength(5);
        expect(getTabText(contactTab)).not.toContain('00003005');
    });

    it('renders missing-parent messages without requesting related records', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord({ contactId: null, accountId: null }));
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'このケースには顧客が設定されていません。'
        );
        expect(element.shadowRoot.textContent).toContain(
            'このケースには会社が設定されていません。'
        );
        expect(element.shadowRoot.querySelectorAll('lightning-spinner')).toHaveLength(
            0
        );
        await expect(element).toBeAccessible();
    });

    it('renders empty and error states independently for each tab', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord());
        await flushPromises();
        emitRelatedCases(CONTACT_RECORD_ID, []);
        getRelatedListRecords.emitError(
            { body: { message: 'Related list failed' }, status: 500 },
            (config) => config.parentRecordId === ACCOUNT_RECORD_ID
        );
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'この顧客の別の問い合わせはありません。'
        );
        expect(element.shadowRoot.textContent).toContain(
            '会社の問い合わせを読み込めませんでした。'
        );
        expect(
            element.shadowRoot.querySelectorAll('[role="alert"]')
        ).toHaveLength(1);
        await expect(element).toBeAccessible();
    });

    it('renders a component error when the current case cannot be loaded', async () => {
        const element = createComponent();

        getRecord.error();
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            '関連する問い合わせを読み込めませんでした。'
        );
        expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();
        expect(element.shadowRoot.querySelector('lightning-tabset')).toBeNull();
        await expect(element).toBeAccessible();
    });
});
