import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getEmailMessageCount from '@salesforce/apex/CaseEmailMessageController.getEmailMessageCount';
import getEmailMessages from '@salesforce/apex/CaseEmailMessageController.getEmailMessages';
import { reduceErrors } from 'c/errorUtils';

const LOAD_ERROR_MESSAGE =
    'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。';

export default class CaseEmailMessageList extends LightningElement {
    @api recordId;

    emailMessages = [];
    errorMessage;
    loadMoreErrorMessage;
    totalEmailMessageCount = 0;
    hasNextPage = false;
    nextPageToken;
    initialPageToken;
    isRefreshing = false;
    isLoadingMore = false;
    wiredEmailMessagesResult;
    wiredEmailMessageCountResult;

    @wire(getEmailMessageCount, { caseId: '$recordId' })
    wiredEmailMessageCount(result) {
        this.wiredEmailMessageCountResult = result;
        const { data, error } = result;

        if (data !== undefined) {
            this.totalEmailMessageCount = Number(data);
            this.initialPageToken = null;
            this.errorMessage = undefined;
        } else if (error) {
            this.totalEmailMessageCount = 0;
            this.initialPageToken = undefined;
            this.emailMessages = [];
            this.hasNextPage = false;
            this.nextPageToken = undefined;
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    @wire(getEmailMessages, {
        caseId: '$recordId',
        pageToken: '$initialPageToken'
    })
    wiredEmailMessages(result) {
        this.wiredEmailMessagesResult = result;
        const { data, error } = result;

        if (data) {
            this.applyInitialPage(data);
            this.errorMessage = undefined;
        } else if (error) {
            this.emailMessages = [];
            this.hasNextPage = false;
            this.nextPageToken = undefined;
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    get hasEmailMessages() {
        return this.emailMessages.length > 0;
    }

    get cardTitle() {
        if (!this.hasLoaded || this.errorMessage) {
            return 'メールログ';
        }
        return `メールログ (${this.totalEmailMessageCount})`;
    }

    get hasLoaded() {
        return Boolean(
            this.wiredEmailMessagesResult?.data ||
                this.wiredEmailMessagesResult?.error
        );
    }

    get isBusy() {
        return this.isLoading || this.isRefreshing || this.isLoadingMore;
    }

    get isLoading() {
        return (
            !this.errorMessage &&
            !this.wiredEmailMessagesResult?.data &&
            !this.wiredEmailMessagesResult?.error
        );
    }

    async handleRefresh() {
        if (
            !this.wiredEmailMessageCountResult ||
            !this.wiredEmailMessagesResult
        ) {
            return;
        }

        this.isRefreshing = true;
        this.loadMoreErrorMessage = undefined;
        try {
            await refreshApex(this.wiredEmailMessageCountResult);
            await refreshApex(this.wiredEmailMessagesResult);
        } catch (error) {
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        } finally {
            this.isRefreshing = false;
        }
    }

    async handleLoadMore() {
        if (!this.hasNextPage || !this.nextPageToken || this.isBusy) {
            return;
        }

        this.isLoadingMore = true;
        this.loadMoreErrorMessage = undefined;
        try {
            const page = await getEmailMessages({
                caseId: this.recordId,
                pageToken: this.nextPageToken
            });
            const nextEmailMessages = this.createNextPageDisplayRows(page);
            this.emailMessages = [
                ...this.emailMessages,
                ...nextEmailMessages
            ];
            this.nextPageToken = page.nextPageToken;
            this.updateHasNextPage();
        } catch (error) {
            this.loadMoreErrorMessage = reduceErrors(
                error,
                LOAD_ERROR_MESSAGE
            );
        } finally {
            this.isLoadingMore = false;
        }
    }

    applyInitialPage(page) {
        this.emailMessages = (page.emailMessages || []).map((emailMessage) =>
            this.createDisplayRow(emailMessage)
        );
        this.nextPageToken = page.nextPageToken;
        this.updateHasNextPage();
        this.loadMoreErrorMessage = undefined;
    }

    updateHasNextPage() {
        this.hasNextPage = Boolean(
            this.nextPageToken &&
                this.emailMessages.length < this.totalEmailMessageCount
        );
    }

    createNextPageDisplayRows(page) {
        const rangeStart = this.emailMessages.length + 1;
        const nextEmailMessages = (page.emailMessages || []).map(
            (emailMessage) => this.createDisplayRow(emailMessage)
        );
        if (nextEmailMessages.length === 0) {
            return nextEmailMessages;
        }

        const rangeEnd = rangeStart + nextEmailMessages.length - 1;
        nextEmailMessages[0] = {
            ...nextEmailMessages[0],
            hasPageSeparator: true,
            pageSeparatorId: `email-page-separator-${rangeStart}-${rangeEnd}`,
            pageSeparatorMessage: `${rangeStart}件目から${rangeEnd}件目を読み込みました`
        };
        return nextEmailMessages;
    }

    createDisplayRow(emailMessage) {
        const direction = emailMessage.Incoming ? '受信' : '送信';
        const directionIconName = emailMessage.Incoming
            ? 'utility:email_open'
            : 'utility:sender_email';
        const fromAddress = emailMessage.FromAddress || '(差出人なし)';
        const toAddress = emailMessage.ToAddress || '(宛先なし)';

        return {
            id: emailMessage.Id,
            body: emailMessage.TextBody || '(本文なし)',
            direction,
            directionIconName,
            detailsId: `email-message-details-${emailMessage.Id}`,
            fromAddress,
            fromAddressUrl: `mailto:${encodeURIComponent(fromAddress)}`,
            headingId: `email-message-${emailMessage.Id}`,
            messageDate: emailMessage.MessageDate,
            recordUrl: `/lightning/r/EmailMessage/${emailMessage.Id}/view`,
            subject: emailMessage.Subject || '(件名なし)',
            summary: `${fromAddress} から ${toAddress} への${direction}メール`,
            summaryId: `email-message-summary-${emailMessage.Id}`,
            toAddress,
            toAddressUrl: `mailto:${encodeURIComponent(toAddress)}`
        };
    }
}
