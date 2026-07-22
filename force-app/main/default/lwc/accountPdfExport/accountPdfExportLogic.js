const ACCOUNT_ID_PATTERN = /^001[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/;

export const isAccountRecordId = (recordId) =>
    ACCOUNT_ID_PATTERN.test(recordId || '');

export const createPdfPageReference = (recordId) => ({
    type: 'standard__webPage',
    attributes: {
        url: `/apex/AccountPdf?accountId=${encodeURIComponent(recordId)}`
    }
});
