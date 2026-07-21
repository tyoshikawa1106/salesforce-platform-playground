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
    accountId = ACCOUNT_RECORD_ID,
    caseNumber = '00001000',
    subject = '現在の問い合わせ',
    status = '対応中',
    reason = '操作方法',
    createdDate = '2026-07-18T01:30:00.000Z',
    accountName = 'サンプル取引先',
    contactName = '山田 太郎'
} = {}) => ({
    apiName: 'Case',
    fields: {
        Id: { value: CASE_RECORD_ID },
        ContactId: { value: contactId },
        AccountId: { value: accountId },
        CaseNumber: { value: caseNumber },
        Subject: { value: subject },
        Status: { value: status },
        Reason: { value: reason },
        CreatedDate: { value: createdDate },
        Account: {
            value: accountId
                ? {
                      apiName: 'Account',
                      fields: { Name: { value: accountName } }
                  }
                : null
        },
        Contact: {
            value: contactId
                ? {
                      apiName: 'Contact',
                      fields: { Name: { value: contactName } }
                  }
                : null
        }
    },
    id: CASE_RECORD_ID
});

const createRelatedCase = ({
    id,
    caseNumber,
    subject = 'ログイン方法を確認したい',
    status = '新規',
    reason = '機能不備',
    accountName = '関連取引先',
    contactName = '佐藤 花子',
    createdDate = '2026-07-17T01:30:00.000Z'
}) => ({
    apiName: 'Case',
    fields: {
        CaseNumber: { value: caseNumber },
        Subject: { value: subject },
        Status: { value: status },
        Reason: { value: reason },
        Account: {
            value: {
                apiName: 'Account',
                fields: { Name: { value: accountName } }
            }
        },
        Contact: {
            value: {
                apiName: 'Contact',
                fields: { Name: { value: contactName } }
            }
        },
        CreatedDate: { value: createdDate }
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
        ...(element.matches('.c-case-tile') ? [element] : []),
        ...element.querySelectorAll('.c-case-tile')
    ]);

const getTileCaseNumber = (tile) => tile.querySelector('h3').textContent.trim();

const getTileLink = (tile) => tile.querySelector('a');

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
                pageSize: 20,
                parentRecordId: ACCOUNT_RECORD_ID,
                relatedListId: 'Cases',
                fields: ['Case.CaseNumber', 'Case.CreatedDate'],
                optionalFields: [
                    'Case.Subject',
                    'Case.Status',
                    'Case.Reason',
                    'Case.Account.Name',
                    'Case.Contact.Name'
                ],
                sortBy: ['-Case.CreatedDate']
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
                subject: '契約内容を確認したい'
            })
        ]);
        await flushPromises();

        const tabs = element.shadowRoot.querySelectorAll('lightning-tab');
        const tabset = element.shadowRoot.querySelector('lightning-tabset');
        const tabContainer = element.shadowRoot.querySelector(
            '.c-related-case-tabs'
        );
        const tabLists = element.shadowRoot.querySelectorAll('ul');
        const contactTiles = getTabTiles(tabs[0]);
        const accountTiles = getTabTiles(tabs[1]);
        const tiles = [...contactTiles, ...accountTiles];

        expect(tabset.variant).toBe('standard');
        expect(tabContainer.classList).toContain('slds-p-horizontal_medium');
        expect(tabContainer.classList).toContain('slds-p-bottom_medium');
        expect(
            [...tabLists].every(
                (list) =>
                    list.classList.contains('slds-p-vertical_small') &&
                    !list.classList.contains('slds-p-around_small')
            )
        ).toBe(true);
        expect([...tabs].map((tab) => tab.label)).toEqual(['顧客', '会社']);
        expect([...tiles].map(getTileCaseNumber)).toEqual([
            '00001000',
            '00001001',
            '00001002',
            '00001000',
            '00002001'
        ]);
        expect(getTileLink(contactTiles[0])).toBeNull();
        expect(getTileLink(accountTiles[0])).toBeNull();
        expect(
            [...contactTiles.slice(1), ...accountTiles.slice(1)].every(
                (tile) => {
                    const link = getTileLink(tile);

                    return (
                        link?.getAttribute('href') ===
                            'https://www.example.com' &&
                        link.target === '_blank' &&
                        link.rel === 'noopener'
                    );
                }
            )
        ).toBe(true);
        expect(getTabText(tabs[1])).toContain('契約内容を確認したい');
        expect(getTabText(tabs[1])).toContain('状況 新規');
        expect(getTabText(tabs[1])).toContain('原因 機能不備');
        expect(getTabText(tabs[1])).toContain('オープン日');
        expect(getTabText(tabs[1])).toContain('取引先 関連取引先');
        expect(getTabText(tabs[1])).toContain('取引先責任者 佐藤 花子');
        expect(element.shadowRoot.querySelector('lightning-badge')).toBeNull();
        expect(
            tiles.flatMap((tile) => [
                ...tile.querySelectorAll('lightning-formatted-date-time')
            ])
        ).toHaveLength(5);
        await expect(element).toBeAccessible();
    });

    it('renders the current case without a link when it is the only related case', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord());
        await flushPromises();
        emitRelatedCases(CONTACT_RECORD_ID, [
            createRelatedCase({
                id: CASE_RECORD_ID,
                caseNumber: '00001000'
            })
        ]);
        await flushPromises();

        const contactTab = element.shadowRoot.querySelectorAll('lightning-tab')[0];

        const tiles = getTabTiles(contactTab);

        expect(tiles).toHaveLength(1);
        expect(getTileCaseNumber(tiles[0])).toBe('00001000');
        expect(getTileLink(tiles[0])).toBeNull();
        expect(getTabText(contactTab)).not.toContain(
            'この顧客の問い合わせはありません。'
        );
        await expect(element).toBeAccessible();
    });

    it('includes the current case and limits each tab to twenty cases by created date', async () => {
        const element = createComponent();
        const relatedCases = Array.from({ length: 21 }, (_, index) =>
            createRelatedCase({
                id: `50000000000001${index}AAA`,
                caseNumber: `000030${String(index).padStart(2, '0')}`,
                createdDate: `2026-07-${String(31 - index).padStart(2, '0')}T01:30:00.000Z`
            })
        );

        getRecord.emit(
            createCaseRecord({ createdDate: '2026-06-01T01:30:00.000Z' })
        );
        await flushPromises();
        emitRelatedCases(CONTACT_RECORD_ID, relatedCases);
        await flushPromises();

        const contactTab = element.shadowRoot.querySelectorAll('lightning-tab')[0];

        expect(getTabTiles(contactTab)).toHaveLength(20);
        expect([...getTabTiles(contactTab)].map(getTileCaseNumber)).toEqual([
            '00003000',
            '00003001',
            '00003002',
            '00003003',
            '00003004',
            '00003005',
            '00003006',
            '00003007',
            '00003008',
            '00003009',
            '00003010',
            '00003011',
            '00003012',
            '00003013',
            '00003014',
            '00003015',
            '00003016',
            '00003017',
            '00003018',
            '00001000'
        ]);
    });

    it('renders missing-parent messages without requesting related records', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord({ contactId: null, accountId: null }));
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'このケースには取引先責任者が設定されていません。'
        );
        expect(element.shadowRoot.textContent).toContain(
            'このケースには取引先が設定されていません。'
        );
        expect(element.shadowRoot.querySelectorAll('lightning-spinner')).toHaveLength(
            0
        );
        await expect(element).toBeAccessible();
    });

    it('renders the current case and an account error independently', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord());
        await flushPromises();
        emitRelatedCases(CONTACT_RECORD_ID, []);
        getRelatedListRecords.emitError(
            { body: { message: 'Related list failed' }, status: 500 },
            (config) => config.parentRecordId === ACCOUNT_RECORD_ID
        );
        await flushPromises();

        const contactTab = element.shadowRoot.querySelectorAll('lightning-tab')[0];

        expect(getTabTiles(contactTab)).toHaveLength(1);
        expect(getTileLink(getTabTiles(contactTab)[0])).toBeNull();
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
