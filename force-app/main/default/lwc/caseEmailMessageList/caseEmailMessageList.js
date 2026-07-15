import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getEmailMessages from '@salesforce/apex/CaseEmailMessageController.getEmailMessages';
import { reduceErrors } from 'c/errorUtils';

const COLUMNS = [
    {
        label: '日時',
        fieldName: 'messageDate',
        type: 'date',
        typeAttributes: {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }
    },
    {
        label: '送受信',
        fieldName: 'direction',
        type: 'text'
    },
    {
        label: '件名',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'subject' },
            target: '_blank'
        }
    },
    {
        label: '差出人',
        fieldName: 'fromAddress',
        type: 'email'
    },
    {
        label: '宛先',
        fieldName: 'toAddress',
        type: 'text'
    }
];

const LOAD_ERROR_MESSAGE =
    'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。';

export default class CaseEmailMessageList extends LightningElement {
    @api recordId;

    columns = COLUMNS;
    emailMessages = [];
    errorMessage;
    isRefreshing = false;
    wiredEmailMessagesResult;

    @wire(getEmailMessages, { caseId: '$recordId' })
    wiredEmailMessages(result) {
        this.wiredEmailMessagesResult = result;
        const { data, error } = result;

        if (data) {
            this.emailMessages = data.map((emailMessage) =>
                this.createDisplayRow(emailMessage)
            );
            this.errorMessage = undefined;
        } else if (error) {
            this.emailMessages = [];
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    get hasEmailMessages() {
        return this.emailMessages.length > 0;
    }

    get hasLoaded() {
        return Boolean(
            this.wiredEmailMessagesResult?.data ||
                this.wiredEmailMessagesResult?.error
        );
    }

    get isBusy() {
        return this.isLoading || this.isRefreshing;
    }

    get isLoading() {
        return (
            !this.errorMessage &&
            !this.wiredEmailMessagesResult?.data &&
            !this.wiredEmailMessagesResult?.error
        );
    }

    async handleRefresh() {
        if (!this.wiredEmailMessagesResult) {
            return;
        }

        this.isRefreshing = true;
        try {
            await refreshApex(this.wiredEmailMessagesResult);
        } catch (error) {
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        } finally {
            this.isRefreshing = false;
        }
    }

    createDisplayRow(emailMessage) {
        return {
            id: emailMessage.Id,
            direction: emailMessage.Incoming ? '受信' : '送信',
            fromAddress: emailMessage.FromAddress,
            messageDate: emailMessage.MessageDate,
            recordUrl: `/lightning/r/EmailMessage/${emailMessage.Id}/view`,
            subject: emailMessage.Subject || '(件名なし)',
            toAddress: emailMessage.ToAddress
        };
    }
}
