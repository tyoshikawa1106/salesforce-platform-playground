export const FORM_MODE_RECORD = 'record';
export const FORM_MODE_FILE_UPLOAD = 'fileUpload';
export const FORM_MODE_UNSUPPORTED = 'unsupported';

const FORM_FIELD_OVERRIDES = {
    Account: [
        { apiName: 'Name', required: true },
        { apiName: 'Industry', required: false }
    ],
    Contact: [
        { apiName: 'FirstName', required: true },
        { apiName: 'LastName', required: true }
    ],
    Lead: [
        { apiName: 'FirstName', required: true },
        { apiName: 'LastName', required: true },
        { apiName: 'Company', required: true }
    ],
    Opportunity: [
        { apiName: 'Name', required: true },
        { apiName: 'StageName', required: true },
        { apiName: 'CloseDate', required: true }
    ]
};

const DEFAULT_OBJECT_UI_CAPABILITY = {
    formMode: FORM_MODE_RECORD,
    newButtonLabel: '新規'
};

const OBJECT_UI_CAPABILITIES = {
    ContentDocument: {
        formMode: FORM_MODE_FILE_UPLOAD,
        newButtonLabel: 'アップロード',
        message: 'ファイルはアップロードで新規登録します。'
    },
    EmailMessage: {
        formMode: FORM_MODE_UNSUPPORTED,
        newButtonLabel: '新規',
        message: 'メールメッセージは汎用フォームの対象外です。'
    }
};

export function getConfiguredFormFields(objectApiName) {
    return FORM_FIELD_OVERRIDES[objectApiName] ?? [];
}

export function getObjectUiCapability(objectApiName) {
    return OBJECT_UI_CAPABILITIES[objectApiName] ?? DEFAULT_OBJECT_UI_CAPABILITY;
}