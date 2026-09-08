import { createElement } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import CaseEmailMessageList from 'c/caseEmailMessageList';
import getEmailMessageCount from '@salesforce/apex/CaseEmailMessageController.getEmailMessageCount';
import getEmailMessagePaginationCursor from '@salesforce/apex/CaseEmailMessageController.getEmailMessagePaginationCursor';
import getEmailMessages from '@salesforce/apex/CaseEmailMessageController.getEmailMessages';

jest.mock(
    '@salesforce/apex/CaseEmailMessageController.getEmailMessageCount',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn()
    }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/CaseEmailMessageController.getEmailMessagePaginationCursor',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/CaseEmailMessageController.getEmailMessages',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

const paginationCursor = { cursorId: 'pagination-cursor' };

const emailMessages = [
    {
        Id: '02s000000000001AAA',
        Subject: '受信メール',
        FromAddress: 'sender@example.com',
        ToAddress: 'support@example.com',
        MessageDate: '2026-07-16T02:00:00.000Z',
        Incoming: true,
        TextBody: 'お問い合わせありがとうございます。\n確認します。'
    },
    {
        Id: '02s000000000002AAA',
        Subject: null,
        FromAddress: 'support@example.com',
        ToAddress: 'recipient@example.com',
        MessageDate: '2026-07-16T03:00:00.000Z',
        Incoming: false,
        TextBody: null
    }
];

const initialPage = {
    emailMessages,
    hasNextPage: true,
    nextIndex: 50
};

const emptyPage = {
    emailMessages: [],
    hasNextPage: false,
    nextIndex: 0
};

const nextPage = {
    emailMessages: [
        {
            Id: '02s000000000003AAA',
            Subject: '次のメール',
            FromAddress: 'next.sender@example.com',
            ToAddress: 'support@example.com',
            MessageDate: '2026-07-16T04:00:00.000Z',
            Incoming: true,
            TextBody: '次のメール本文'
        }
    ],
    hasNextPage: false,
    nextIndex: 51
};

function createComponent() {
    const element = createElement('c-case-email-message-list', {
        is: CaseEmailMessageList
    });
    element.recordId = '500000000000001AAA';
    document.body.appendChild(element);
    return element;
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

async function emitCountAndPage(count, page) {
    getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
    getEmailMessages.mockResolvedValueOnce(page);
    getEmailMessageCount.emit(count);
    await flushPromises();
    await flushPromises();
}

describe('c-case-email-message-list', () => {
    it.each(['initial', 'more'])('preserves count errors after an in-flight %s page and recovers on refresh', async (phase) => {
        const element = createComponent();
        if (phase === 'more') {
            await emitCountAndPage(100, initialPage);
        }
        let finishPage;
        getEmailMessages.mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve; }));
        if (phase === 'initial') {
            getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
            getEmailMessageCount.emit(100);
        } else {
            element.shadowRoot.querySelector('lightning-button').click();
        }
        await flushPromises();
        getEmailMessageCount.error({ message: '件数取得失敗' });
        await flushPromises();
        const callsBeforeCompletion = getEmailMessages.mock.calls.length;
        finishPage(phase === 'initial' ? initialPage : nextPage);
        await flushPromises();
        await flushPromises();

        expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('件数取得失敗');
        expect(element.shadowRoot.querySelector('ul.slds-timeline')).toBeNull();
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe('メールログ');
        expect(getEmailMessages).toHaveBeenCalledTimes(callsBeforeCompletion);
        expect(element.shadowRoot.querySelector('lightning-button-icon').disabled).toBe(false);

        refreshApex.mockImplementationOnce(async () => { getEmailMessageCount.emit(0); });
        getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
        getEmailMessages.mockResolvedValueOnce(emptyPage);
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe('メールログ (0)');
        expect(getEmailMessages).toHaveBeenCalledTimes(callsBeforeCompletion + 1);
    });

    it('waits for an invalidated initial page before loading a recovered count', async () => {
        const element = createComponent();
        let finishPage;
        getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
        getEmailMessages.mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve; }));
        getEmailMessageCount.emit(100);
        await flushPromises();
        getEmailMessageCount.error({ message: '件数取得失敗' });
        await flushPromises();
        getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
        getEmailMessages.mockResolvedValueOnce(emptyPage);
        getEmailMessageCount.emit(0);
        await flushPromises();
        expect(getEmailMessages).toHaveBeenCalledTimes(1);
        finishPage(initialPage);
        await flushPromises();
        await flushPromises();
        await flushPromises();
        expect(getEmailMessages).toHaveBeenCalledTimes(2);
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(element.shadowRoot.querySelector('ul.slds-timeline')).toBeNull();
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe('メールログ (0)');
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
    });

    it('アドレスがないメールはリンクなしの代替ラベルを描画する', async () => {
        const element = createComponent();
        await emitCountAndPage(1, { emailMessages: [{ ...emailMessages[0], FromAddress: null, ToAddress: '  ' }], hasNextPage: false, nextIndex: 1 });
        expect(element.shadowRoot.querySelectorAll('a[href^="mailto:"]')).toHaveLength(0);
        expect(element.shadowRoot.textContent).toContain('(差出人なし)');
        expect(element.shadowRoot.textContent).toContain('(宛先なし)');
    });

    it('loads the new case when navigation changes during refresh', async () => {
        const element = createComponent();
        await emitCountAndPage(100, initialPage);
        await flushPromises();
        refreshApex.mockResolvedValue();
        getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
        let finishOldRequest;
        getEmailMessages.mockImplementationOnce(() => new Promise((resolve) => { finishOldRequest = resolve; }));
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();

        element.recordId = '500000000000002AAA';
        await flushPromises();
        getEmailMessagePaginationCursor.mockResolvedValueOnce({ cursorId: 'new-case' });
        getEmailMessages.mockResolvedValueOnce(emptyPage);
        getEmailMessageCount.emit(0);
        finishOldRequest(initialPage);
        await flushPromises();
        await flushPromises();
        expect(getEmailMessages).toHaveBeenLastCalledWith({ caseId: '500000000000002AAA', paginationCursor: { cursorId: 'new-case' }, startIndex: 0 });
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('このケースに紐づくメールメッセージはありません。');
    });

    it.each(['success', 'failure'])('ignores an old case load-more %s after another case has loaded', async (outcome) => {
        const element = createComponent();
        await emitCountAndPage(100, initialPage);
        await flushPromises();
        let finishOldRequest;
        getEmailMessages.mockImplementationOnce(() => new Promise((resolve, reject) => {
            finishOldRequest = outcome === 'success' ? () => resolve(nextPage) : () => reject(new Error('古いケースの失敗'));
        }));
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();

        element.recordId = '500000000000002AAA';
        await flushPromises();
        const newCursor = { cursorId: 'new-case-cursor' };
        getEmailMessagePaginationCursor.mockResolvedValueOnce(newCursor);
        getEmailMessages.mockResolvedValueOnce({ emailMessages: [{ Id: '02s000000000004AAA', Subject: '新しいケース' }], hasNextPage: true, nextIndex: 50 });
        getEmailMessageCount.emit(60);
        await flushPromises();
        await flushPromises();
        await flushPromises();

        // 新しいケースの追加取得中に古い取得が完了しても操作抑止を解除しない。
        let finishNewRequest;
        getEmailMessages.mockImplementationOnce(() => new Promise((resolve) => { finishNewRequest = resolve; }));
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();
        finishOldRequest();
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.textContent).toContain('新しいケース');
        expect(element.shadowRoot.textContent).not.toContain('次のメール');
        expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
        expect(element.shadowRoot.querySelector('lightning-button').disabled).toBe(true);
        expect(getEmailMessages).toHaveBeenLastCalledWith({ caseId: '500000000000002AAA', paginationCursor: newCursor, startIndex: 50 });

        finishNewRequest(emptyPage);
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
    });

    it('discards an old page even when navigation returns to the original case', async () => {
        const element = createComponent();
        await emitCountAndPage(100, initialPage);
        await flushPromises();
        let finishOldRequest;
        getEmailMessages.mockImplementationOnce(() => new Promise((resolve) => { finishOldRequest = resolve; }));
        element.shadowRoot.querySelector('lightning-button').click();
        await flushPromises();
        element.recordId = '500000000000002AAA';
        element.recordId = '500000000000001AAA';
        await flushPromises();
        await emitCountAndPage(1, { emailMessages: [emailMessages[0]], hasNextPage: false, nextIndex: 1 });
        await flushPromises();
        finishOldRequest(nextPage);
        await flushPromises();
        await flushPromises();
        expect(element.shadowRoot.querySelectorAll('ul.slds-timeline [role="listitem"]')).toHaveLength(1);
        expect(element.shadowRoot.textContent).not.toContain('次のメール');
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders case email messages from Apex data', async () => {
        const element = createComponent();

        await emitCountAndPage(3, initialPage);

        expect(getEmailMessagePaginationCursor).toHaveBeenCalledWith({
            caseId: '500000000000001AAA'
        });
        expect(getEmailMessages).toHaveBeenCalledWith({
            caseId: '500000000000001AAA',
            paginationCursor,
            startIndex: 0
        });

        const timeline = element.shadowRoot.querySelector('ul.slds-timeline');
        const timelineItems = timeline.querySelectorAll('[role="listitem"]');
        const recordLinks = timeline.querySelectorAll('h3 a');
        const emailLinks = timeline.querySelectorAll('a[href^="mailto:"]');
        const emailIconContainers = timeline.querySelectorAll('.slds-icon-standard-email.slds-timeline__icon');
        const emailIcons = timeline.querySelectorAll('.slds-icon-standard-email.slds-timeline__icon lightning-icon');
        const timelineItemContainers = timeline.querySelectorAll('.slds-timeline__item_expandable.slds-is-open');
        const details = timeline.querySelectorAll('.slds-timeline__item_details');
        const formattedDates = timeline.querySelectorAll('lightning-formatted-date-time');

        expect(timeline).not.toBeNull();
        expect(timeline.getAttribute('aria-label')).toBe('メールメッセージの活動履歴');
        expect(timelineItems).toHaveLength(2);
        expect(timeline.querySelector('[role="separator"]')).toBeNull();
        expect(recordLinks[0].textContent).toBe('受信メール');
        expect(recordLinks[0].getAttribute('href')).toBe('/lightning/r/EmailMessage/02s000000000001AAA/view');
        expect(recordLinks[1].textContent).toBe('(件名なし)');
        expect(emailLinks).toHaveLength(4);
        expect(emailLinks[0].textContent).toBe('sender@example.com');
        expect(emailLinks[0].getAttribute('href')).toBe('mailto:sender%40example.com');
        expect(emailLinks[1].textContent).toBe('support@example.com');
        expect(emailLinks[1].getAttribute('href')).toBe('mailto:support%40example.com');
        expect(timeline.querySelector('lightning-badge')).toBeNull();
        expect(timelineItemContainers).toHaveLength(2);
        expect(emailIconContainers).toHaveLength(2);
        expect(emailIconContainers[0].classList).toContain('c-timeline-icon');
        expect(emailIcons).toHaveLength(2);
        expect(emailIcons[0].iconName).toBe('utility:email_open');
        expect(emailIcons[1].iconName).toBe('utility:sender_email');
        expect(emailIcons[0].size).toBe('x-small');
        expect(emailIcons[0].alternativeText).toBe('受信');
        expect(emailIcons[1].alternativeText).toBe('送信');
        expect(formattedDates[0].weekday).toBe('short');
        expect(timeline.querySelector('button[aria-controls]')).toBeNull();
        expect(details[0].hidden).toBe(false);
        expect(details[0].querySelector('dl')).toBeNull();
        expect(details[0].querySelector('h4')).toBeNull();
        expect(details[0].textContent).not.toContain('差出人:');
        expect(details[0].textContent).not.toContain('宛先:');
        expect(timeline.textContent).toContain('への受信メール');
        expect(timeline.textContent).toContain('への送信メール');
        expect(timeline.textContent).toContain('お問い合わせありがとうございます。\n確認します。');
        expect(timeline.textContent).toContain('(本文なし)');
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe('メールログ (3)');
        expect(element.shadowRoot.querySelector('lightning-button').label).toBe('次のメールを読み込む');
        expect(timeline.nextElementSibling.querySelector('lightning-button')).not.toBeNull();
        await expect(element).toBeAccessible();
    });

    it('renders an empty state when no email messages exist', async () => {
        const element = createComponent();

        await emitCountAndPage(0, emptyPage);

        expect(element.shadowRoot.querySelector('ul.slds-timeline')).toBeNull();
        expect(element.shadowRoot.textContent).toContain('このケースに紐づくメールメッセージはありません。');
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe('メールログ (0)');
        await expect(element).toBeAccessible();
    });

    it('renders only the loading state before the wire responds', async () => {
        const element = createComponent();
        await flushPromises();

        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
        expect(element.shadowRoot.textContent).not.toContain('このケースに紐づくメールメッセージはありません。');
    });

    it('renders an accessible error when Apex loading fails', async () => {
        const element = createComponent();

        getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
        getEmailMessages.mockRejectedValueOnce({
            body: { message: 'メールメッセージを取得できません。' }
        });
        getEmailMessageCount.emit(2);
        await flushPromises();
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(alert.textContent).toContain('メールメッセージを取得できません。');
        await expect(element).toBeAccessible();
    });

    it('refreshes the wired result from the card action', async () => {
        refreshApex.mockResolvedValue();
        const element = createComponent();
        await emitCountAndPage(3, initialPage);
        getEmailMessagePaginationCursor.mockResolvedValueOnce(paginationCursor);
        getEmailMessages.mockResolvedValueOnce(initialPage);

        const refreshButton = [...element.shadowRoot.querySelectorAll('lightning-button-icon')].find(
            (button) => button.alternativeText === '再読み込み'
        );

        refreshButton.dispatchEvent(new CustomEvent('click'));
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(getEmailMessagePaginationCursor).toHaveBeenCalledTimes(2);
        expect(getEmailMessages).toHaveBeenCalledTimes(2);
    });

    it('appends newer email messages when loading the next page', async () => {
        const element = createComponent();
        await emitCountAndPage(3, initialPage);
        getEmailMessages.mockResolvedValueOnce(nextPage);

        const loadMoreButton = element.shadowRoot.querySelector('lightning-button');
        loadMoreButton.dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        await flushPromises();

        const timelineItems = element.shadowRoot.querySelectorAll('ul.slds-timeline li[aria-labelledby]');
        const recordLinks = element.shadowRoot.querySelectorAll('ul.slds-timeline h3 a');
        const pageSeparator = element.shadowRoot.querySelector('ul.slds-timeline [role="separator"]');

        expect(getEmailMessages).toHaveBeenLastCalledWith({
            caseId: '500000000000001AAA',
            paginationCursor,
            startIndex: 50
        });
        expect(timelineItems).toHaveLength(3);
        expect(recordLinks[2].textContent).toBe('次のメール');
        expect(pageSeparator).not.toBeNull();
        expect(pageSeparator.textContent).toContain('3件目から3件目を読み込みました');
        expect(pageSeparator.getAttribute('aria-label')).toBe('3件目から3件目を読み込みました');
        expect(element.shadowRoot.querySelector('lightning-card').title).toBe('メールログ (3)');
        expect(element.shadowRoot.querySelector('lightning-button')).toBeNull();
    });

    it('keeps loaded email messages when loading the next page fails', async () => {
        const element = createComponent();
        await emitCountAndPage(3, initialPage);
        getEmailMessages.mockRejectedValueOnce(new Error('取得失敗'));

        const loadMoreButton = element.shadowRoot.querySelector('lightning-button');
        loadMoreButton.dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        const timelineItems = element.shadowRoot.querySelectorAll('ul.slds-timeline [role="listitem"]');

        expect(alert.textContent).toContain('取得失敗');
        expect(timelineItems).toHaveLength(2);
    });
});
