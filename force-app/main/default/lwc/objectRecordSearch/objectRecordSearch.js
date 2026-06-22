import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';
import { createToastMessage, reduceErrors } from 'c/errorUtils';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
});

const BASE_COLUMNS = [
    {
        label: 'Name',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'name' },
            target: '_self'
        }
    },
    { label: '作成日', fieldName: 'createdDateLabel', type: 'text' },
    { label: '最終更新日', fieldName: 'lastModifiedDateLabel', type: 'text' }
];

const ROW_ACTIONS = [{ label: '編集', name: 'edit' }];
const DEFAULT_FORM_SECTION_LABEL = '基本情報';

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

const FORM_MODE_RECORD = 'record';
const FORM_MODE_FILE_UPLOAD = 'fileUpload';
const FORM_MODE_UNSUPPORTED = 'unsupported';

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

export default class ObjectRecordSearch extends LightningElement {
    @api metricKey;

    draftSearchTerm = '';
    searchTerm = '';
    rows = [];
    selectedRowIds = [];
    config;
    errorMessage;
    isDeleting = false;
    isSaving = false;
    formRecordId;
    showRecordForm = false;
    wiredSearchResult;
    objectInfoResult;
    formLayoutResult;

    @wire(searchRecords, {
        metricKey: '$metricKey',
        searchTerm: '$searchTerm'
    })
    wiredRecords(result) {
        this.wiredSearchResult = result;
        const { data, error } = result;

        if (data) {
            this.config = data.config;
            this.rows = (data.records ?? []).map((record) => ({
                ...record,
                createdDateLabel: this.formatDate(record.createdDate),
                lastModifiedDateLabel: this.formatDate(record.lastModifiedDate)
            }));
            this.selectedRowIds = [];
            this.errorMessage = undefined;
        } else if (error) {
            this.rows = [];
            this.selectedRowIds = [];
            this.errorMessage = reduceErrors(
                error,
                'レコード一覧を読み込めませんでした。'
            );
        }
    }

    @wire(getObjectInfo, { objectApiName: '$layoutObjectApiName' })
    wiredObjectInfo(result) {
        this.objectInfoResult = result;
    }

    @wire(getLayout, {
        objectApiName: '$layoutObjectApiName',
        layoutType: 'Full',
        mode: '$layoutMode',
        recordTypeId: '$defaultRecordTypeId'
    })
    wiredFormLayout(result) {
        this.formLayoutResult = result;
    }

    get title() {
        return this.config?.objectLabel
            ? `${this.config.objectLabel} 一覧`
            : 'レコード一覧';
    }

    get searchLabel() {
        const nameFieldLabel = this.config?.nameFieldLabel ?? 'Name';
        return `${nameFieldLabel} を検索`;
    }

    get columns() {
        const nameFieldLabel = this.config?.nameFieldLabel ?? 'Name';
        const columns = [
            {
                ...BASE_COLUMNS[0],
                label: nameFieldLabel
            },
            ...BASE_COLUMNS.slice(1)
        ];

        if (!this.editDisabled) {
            columns.push({
                type: 'action',
                typeAttributes: { rowActions: ROW_ACTIONS }
            });
        }

        return columns;
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get recordCountLabel() {
        return `${this.rows.length} 個の項目`;
    }

    get selectedCount() {
        return this.selectedRowIds.length;
    }

    get isBusy() {
        return this.isLoading || this.isDeleting || this.isSaving;
    }

    get isLoading() {
        return (
            !this.errorMessage &&
            !this.wiredSearchResult?.data &&
            !this.wiredSearchResult?.error
        );
    }

    get deleteDisabled() {
        return (
            this.isBusy || !this.config?.deletable || this.selectedCount === 0
        );
    }

    get createDisabled() {
        if (this.isFileUploadObject) {
            return this.isBusy;
        }

        return (
            this.isBusy ||
            !this.isRecordFormObject ||
            this.isFormLayoutLoading ||
            !this.config?.createable ||
            this.formFields.length === 0
        );
    }

    get editDisabled() {
        return (
            this.isBusy ||
            !this.isRecordFormObject ||
            this.isFormLayoutLoading ||
            !this.config?.updateable ||
            this.formFields.length === 0
        );
    }

    get objectUiCapability() {
        return (
            OBJECT_UI_CAPABILITIES[this.config?.objectApiName] ??
            DEFAULT_OBJECT_UI_CAPABILITY
        );
    }

    get isFileUploadObject() {
        return this.objectUiCapability.formMode === FORM_MODE_FILE_UPLOAD;
    }

    get isRecordFormObject() {
        return (
            Boolean(this.config?.objectApiName) &&
            this.objectUiCapability.formMode === FORM_MODE_RECORD
        );
    }

    get isFileUploadForm() {
        return this.showRecordForm && this.isFileUploadObject;
    }

    get showLightningRecordForm() {
        return this.showRecordForm && this.isRecordFormObject;
    }

    get layoutObjectApiName() {
        return this.isRecordFormObject ? this.config.objectApiName : undefined;
    }

    get layoutMode() {
        return this.formRecordId ? 'Edit' : 'Create';
    }

    get defaultRecordTypeId() {
        return this.objectInfoResult?.data?.defaultRecordTypeId;
    }

    get isFormLayoutLoading() {
        return (
            this.isRecordFormObject &&
            !this.formLayoutResult?.data &&
            !this.formLayoutResult?.error
        );
    }

    get newButtonLabel() {
        return this.objectUiCapability.newButtonLabel;
    }

    get formCapabilityMessage() {
        return this.config?.objectApiName
            ? this.objectUiCapability.message
            : undefined;
    }

    get formFields() {
        return this.formSections.flatMap((section) => section.fields);
    }

    get formSections() {
        if (!this.isRecordFormObject) {
            return [];
        }

        const layoutSections = this.layoutFormSections;
        if (layoutSections.length > 0) {
            return this.applyFormFieldOverrides(layoutSections);
        }

        if (this.formLayoutResult?.error) {
            return this.fallbackFormSections;
        }

        return [];
    }

    get layoutFormSections() {
        const layout = this.currentLayout;
        const fieldInfoByApiName = this.objectInfoResult?.data?.fields ?? {};
        const fieldApiNames = new Set();
        const sections = [];

        (layout?.sections ?? []).forEach((section, index) => {
            const fields = [];
            (section.layoutRows ?? []).forEach((row) => {
                (row.layoutItems ?? []).forEach((item) => {
                    (item.layoutComponents ?? []).forEach((component) => {
                        const apiName = component.apiName;
                        const fieldInfo = fieldInfoByApiName[apiName];
                        if (
                            component.componentType !== 'Field' ||
                            !apiName ||
                            fieldApiNames.has(apiName) ||
                            !this.isEditableLayoutItem(item) ||
                            !this.isSupportedStandardField(fieldInfo)
                        ) {
                            return;
                        }

                        fieldApiNames.add(apiName);
                        fields.push({
                            apiName,
                            required: Boolean(item.required)
                        });
                    });
                });
            });

            if (fields.length > 0) {
                sections.push(
                    this.createFormSection(
                        section.heading ||
                            section.label ||
                            DEFAULT_FORM_SECTION_LABEL,
                        fields,
                        index
                    )
                );
            }
        });

        return sections;
    }

    get currentLayout() {
        const data = this.formLayoutResult?.data;
        if (!data) {
            return undefined;
        }

        return (
            data.layouts?.[this.config.objectApiName]?.Full?.[
                this.layoutMode
            ] ?? data
        );
    }

    get fallbackFormSections() {
        const configuredFields =
            FORM_FIELD_OVERRIDES[this.config?.objectApiName];
        if (configuredFields) {
            return [
                this.createFormSection(
                    DEFAULT_FORM_SECTION_LABEL,
                    configuredFields,
                    0
                )
            ];
        }

        if (!this.config?.nameFieldApiName) {
            return [];
        }

        return [
            this.createFormSection(
                DEFAULT_FORM_SECTION_LABEL,
                [
                    {
                        apiName: this.config.nameFieldApiName,
                        required: true
                    }
                ],
                0
            )
        ];
    }

    get formTitle() {
        const objectLabel = this.config?.objectLabel ?? 'レコード';
        if (this.isFileUploadObject) {
            return 'ファイルをアップロード';
        }

        return this.formRecordId
            ? `${objectLabel}を編集`
            : `${objectLabel}を作成`;
    }

    get emptyMessage() {
        if (this.searchTerm) {
            return '検索条件に一致するレコードが見つかりません。';
        }
        return 'レコードが見つかりません。';
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('back'));
    }

    async handleRefresh() {
        if (!this.wiredSearchResult) {
            return;
        }

        await refreshApex(this.wiredSearchResult);
    }

    handleSearchInput(event) {
        this.draftSearchTerm = event.target.value;
    }

    handleSearchKeyUp(event) {
        if (event.key === 'Enter') {
            this.handleSearch();
        }
    }

    handleSearch() {
        this.searchTerm = this.draftSearchTerm.trim();
    }

    handleRowSelection(event) {
        this.selectedRowIds = event.detail.selectedRows.map((row) => row.id);
    }

    handleRowAction(event) {
        if (event.detail.action.name !== 'edit' || this.editDisabled) {
            return;
        }

        this.formRecordId = event.detail.row.id;
        this.showRecordForm = true;
    }

    handleNewRecord() {
        if (this.createDisabled) {
            return;
        }

        this.formRecordId = undefined;
        this.showRecordForm = true;
    }

    handleCloseRecordForm() {
        this.showRecordForm = false;
        this.formRecordId = undefined;
        this.isSaving = false;
    }

    handleRecordFormSubmit(event) {
        const isValid = [
            ...this.template.querySelectorAll('lightning-input-field')
        ].reduce((valid, field) => field.reportValidity() && valid, true);
        if (!isValid) {
            event.preventDefault();
            return;
        }

        this.isSaving = true;
    }

    async handleRecordFormSuccess() {
        this.showToast(
            this.formRecordId ? '更新しました' : '作成しました',
            `${this.config.objectLabel}を保存しました。`,
            'success'
        );
        this.handleCloseRecordForm();
        await refreshApex(this.wiredSearchResult);
        this.dispatchEvent(new CustomEvent('recordschanged'));
    }

    async handleUploadFinished(event) {
        const uploadedCount = event.detail?.files?.length ?? 0;
        this.showToast(
            'アップロードしました',
            `${uploadedCount} 件のファイルを登録しました。`,
            'success'
        );
        this.handleCloseRecordForm();
        await refreshApex(this.wiredSearchResult);
        this.dispatchEvent(new CustomEvent('recordschanged'));
    }

    handleRecordFormError(event) {
        this.isSaving = false;
        const message =
            event.detail?.message ??
            `${this.config.objectLabel}を保存できませんでした。`;
        this.showToast('保存に失敗しました', message, 'error');
    }

    async handleDeleteSelected() {
        if (this.deleteDisabled) {
            return;
        }

        this.isDeleting = true;
        try {
            const result = await deleteRecords({
                metricKey: this.metricKey,
                recordIds: this.selectedRowIds
            });
            this.showToast(
                '削除しました',
                `${result.deletedCount} / ${result.requestedCount} 件を削除しました。`,
                'success'
            );
            if (result.errors?.length) {
                this.showToast(
                    '一部削除できませんでした',
                    createToastMessage(
                        result.errors,
                        '一部のレコードを削除できませんでした。'
                    ),
                    'warning'
                );
            }
            await refreshApex(this.wiredSearchResult);
            this.dispatchEvent(new CustomEvent('recordschanged'));
        } catch (error) {
            this.errorMessage = reduceErrors(
                error,
                'レコード一覧を読み込めませんでした。'
            );
            this.showToast('削除に失敗しました', this.errorMessage, 'error');
        } finally {
            this.isDeleting = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    formatDate(value) {
        if (!value) {
            return '';
        }
        return DATE_TIME_FORMATTER.format(new Date(value));
    }

    isEditableLayoutItem(item) {
        return this.formRecordId ? item.editableForUpdate : item.editableForNew;
    }

    isSupportedStandardField(fieldInfo) {
        if (!fieldInfo || fieldInfo.custom) {
            return false;
        }

        return this.formRecordId ? fieldInfo.updateable : fieldInfo.createable;
    }

    applyFormFieldOverrides(sections) {
        const configuredFields =
            FORM_FIELD_OVERRIDES[this.config?.objectApiName] ?? [];
        if (configuredFields.length === 0) {
            return sections;
        }

        const fieldInfoByApiName = this.objectInfoResult?.data?.fields ?? {};
        const existingFieldApiNames = new Set(
            sections.flatMap((section) =>
                section.fields.map((field) => field.apiName)
            )
        );
        const nextSections = sections.map((section) => ({
            ...section,
            fields: [...section.fields]
        }));

        configuredFields.forEach((field) => {
            const fieldInfo = fieldInfoByApiName[field.apiName];
            if (
                !existingFieldApiNames.has(field.apiName) &&
                this.isSupportedStandardField(fieldInfo)
            ) {
                nextSections[0].fields.push(field);
                existingFieldApiNames.add(field.apiName);
                return;
            }

            nextSections.forEach((section) => {
                section.fields = section.fields.map((sectionField) => {
                    if (sectionField.apiName !== field.apiName) {
                        return sectionField;
                    }

                    return {
                        ...sectionField,
                        required: sectionField.required || field.required
                    };
                });
            });
        });

        return nextSections;
    }

    createFormSection(label, fields, index) {
        const key = `section-${index}`;
        return {
            key,
            headingId: `object-record-form-${key}`,
            label: label || DEFAULT_FORM_SECTION_LABEL,
            fields
        };
    }

}
