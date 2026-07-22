import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {
    createPdfPageReference,
    isAccountRecordId
} from './accountPdfExportLogic';

const ERROR_TITLE = 'PDFを出力できません';
const INVALID_ACCOUNT_MESSAGE =
    '取引先レコードを確認できませんでした。ページを再読み込みしてください。';
const OPEN_ERROR_MESSAGE =
    'PDFを開けませんでした。時間をおいてもう一度お試しください。';

export default class AccountPdfExport extends NavigationMixin(
    LightningElement
) {
    @api recordId;

    isExecuting = false;

    @api
    async invoke() {
        if (this.isExecuting) {
            return;
        }

        this.isExecuting = true;
        try {
            if (!isAccountRecordId(this.recordId)) {
                this.showError(INVALID_ACCOUNT_MESSAGE);
                return;
            }

            const pageReference = createPdfPageReference(this.recordId);
            const pdfUrl = await this[NavigationMixin.GenerateUrl](
                pageReference
            );
            window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        } catch {
            this.showError(OPEN_ERROR_MESSAGE);
        } finally {
            this.isExecuting = false;
        }
    }

    showError(message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: ERROR_TITLE,
                message,
                variant: 'error'
            })
        );
    }
}
