import { createElement } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import CaseEmailMessageList from 'c/caseEmailMessageList';
import getEmailMessages from '@salesforce/apex/CaseEmailMessageController.getEmailMessages';

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn()
    }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/CaseEmailMessageController.getEmailMessages',
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

const emailMessages = [
    {
        Id: '02s000000000001AAA',
        Subject: '受信メール',
        FromAddress: 'sender@example.com',
        ToAddress: 'support@example.com',
        MessageDate: '2026-07-16T03:00:00.000Z',
        Incoming: true
    },
    {
        Id: '02s000000000002AAA',
        Subject: null,
        FromAddress: 'support@example.com',
        ToAddress: 'recipient@example.com',
        MessageDate: '2026-07-16T02:00:00.000Z',
        Incoming: false
    }
];

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
}

describe('c-case-email-message-list', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders case email messages from Apex data', async () => {
        const element = createComponent();

        getEmailMessages.emit(emailMessages);
        await flushPromises();

        const datatable = element.shadowRoot.querySelector(
            'lightning-datatable'
        );
        expect(datatable).not.toBeNull();
        expect(datatable.data).toEqual([
            expect.objectContaining({
                direction: '受信',
                subject: '受信メール',
                recordUrl:
                    '/lightning/r/EmailMessage/02s000000000001AAA/view'
            }),
            expect.objectContaining({
                direction: '送信',
                subject: '(件名なし)'
            })
        ]);
        expect(datatable.columns.map((column) => column.label)).toEqual([
            '日時',
            '送受信',
            '件名',
            '差出人',
            '宛先'
        ]);
        await expect(element).toBeAccessible();
    });

    it('renders an empty state when no email messages exist', async () => {
        const element = createComponent();

        getEmailMessages.emit([]);
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('lightning-datatable')
        ).toBeNull();
        expect(element.shadowRoot.textContent).toContain(
            'このケースに紐づくメールメッセージはありません。'
        );
        await expect(element).toBeAccessible();
    });

    it('renders only the loading state before the wire responds', async () => {
        const element = createComponent();
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('lightning-spinner')
        ).not.toBeNull();
        expect(element.shadowRoot.textContent).not.toContain(
            'このケースに紐づくメールメッセージはありません。'
        );
    });

    it('renders an accessible error when Apex loading fails', async () => {
        const element = createComponent();

        getEmailMessages.error({
            body: { message: 'メールメッセージを取得できません。' }
        });
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(alert.textContent).toContain(
            'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。'
        );
        await expect(element).toBeAccessible();
    });

    it('refreshes the wired result from the card action', async () => {
        refreshApex.mockResolvedValue();
        const element = createComponent();
        getEmailMessages.emit(emailMessages);
        await flushPromises();

        element.shadowRoot
            .querySelector('lightning-button-icon')
            .dispatchEvent(new CustomEvent('click'));
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
    });
});
