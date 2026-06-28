import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';
import { createToastMessage, reduceErrors } from 'c/errorUtils';
import {
    createColumns,
    createDisplayRow,
    getSortFieldApiName
} from './objectRecordSearchDisplay';
import {
    DEFAULT_SORT_DIRECTION,
    DEFAULT_SORTED_BY,
    createAccessMessages,
    createInitialPaginationState,
    createNextPageState,
    createPaginationStateFromResponse,
    createPreviousPageState,
    normalizeSortDirection
} from './objectRecordSearchState';
import {
    FORM_MODE_FILE_UPLOAD,
    FORM_MODE_RECORD,
    applyFormFieldOverrides,
    createFallbackFormSections,
    createLayoutFormSections,
    getCurrentLayout,
    getObjectUiCapability
} from './objectRecordSearchForm';

const INITIAL_PAGINATION_STATE = createInitialPaginationState();

export default class ObjectRecordSearch extends LightningElement {
    @api metricKey;

    draftSearchTerm = '';
    searchTerm = '';
    rows = [];
    selectedRowIds = [];
    config;
    pageNumber = INITIAL_PAGINATION_STATE.pageNumber;
    pageSize = INITIAL_PAGINATION_STATE.pageSize;
    currentPageToken = INITIAL_PAGINATION_STATE.currentPageToken;
    nextPageToken = INITIAL_PAGINATION_STATE.nextPageToken;
    pageTokenHistory = INITIAL_PAGINATION_STATE.pageTokenHistory;
    sortedBy = DEFAULT_SORTED_BY;
    sortedDirection = DEFAULT_SORT_DIRECTION;
    hasNextPage = INITIAL_PAGINATION_STATE.hasNextPage;
    errorTitle;
    errorMessage;
    isDeleting = false;
    isSaving = false;
    formRecordId;
    showRecordForm = false;
    wiredSearchResult;
    objectInfoResult;
    formLayoutResult;

    @wire(searchRecords, {
        request: '$searchRequest'
    })
    wiredRecords(result) {
        this.wiredSearchResult = result;
        const { data, error } = result;

        if (data) {
            this.config = data.config;
            this.rows = (data.records ?? []).map((record) =>
                createDisplayRow(record, this.config?.displayFields)
            );
            this.applyPaginationState(
                createPaginationStateFromResponse(data, this.pageSize)
            );
            this.selectedRowIds = [];
            this.errorTitle = undefined;
            this.errorMessage = undefined;
        } else if (error) {
            this.rows = [];
            this.nextPageToken = undefined;
            this.hasNextPage = false;
            this.selectedRowIds = [];
            this.errorTitle = this.isAccessError(error)
                ? 'アクセス権限を確認してください'
                : 'レコード一覧を読み込めませんでした';
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

    get searchRequest() {
        return {
            metricKey: this.metricKey,
            searchTerm: this.searchTerm,
            pageToken: this.currentPageToken,
            sortBy: this.sortFieldApiName,
            sortDirection: this.sortedDirection,
            pageNumber: this.pageNumber
        };
    }

    get sortFieldApiName() {
        return getSortFieldApiName({
            sortedBy: this.sortedBy,
            nameFieldApiName: this.config?.nameFieldApiName ?? 'Name'
        });
    }

    get searchLabel() {
        const nameFieldLabel = this.config?.nameFieldLabel ?? 'Name';
        return `${nameFieldLabel} を検索`;
    }

    get columns() {
        return createColumns({
            nameFieldLabel: this.config?.nameFieldLabel ?? 'Name',
            displayFields: this.config?.displayFields,
            editDisabled: this.editDisabled
        });
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    get pageLabel() {
        return `現在のページ: ${this.pageNumber}`;
    }

    get previousDisabled() {
        return this.isBusy || this.pageNumber <= 1;
    }

    get nextDisabled() {
        return this.isBusy || !this.hasNextPage;
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
        return getObjectUiCapability(this.config?.objectApiName);
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

    get hasAccessMessages() {
        return this.accessMessages.length > 0;
    }

    get accessMessages() {
        return createAccessMessages({
            config: this.config,
            formCapabilityMessage: this.formCapabilityMessage,
            isFileUploadObject: this.isFileUploadObject,
            isRecordFormObject: this.isRecordFormObject,
            shouldShowFormFieldMessage: this.shouldShowFormFieldMessage,
            hasFormLayoutError: Boolean(this.formLayoutResult?.error)
        });
    }

    get shouldShowFormFieldMessage() {
        return (
            this.isRecordFormObject &&
            !this.isFormLayoutLoading &&
            this.config?.createable &&
            this.config?.updateable &&
            this.formFields.length === 0
        );
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
            return applyFormFieldOverrides({
                sections: layoutSections,
                objectApiName: this.config?.objectApiName,
                fieldInfoByApiName: this.objectInfoResult?.data?.fields,
                formRecordId: this.formRecordId
            });
        }

        if (this.formLayoutResult?.error) {
            return this.fallbackFormSections;
        }

        return [];
    }

    get layoutFormSections() {
        return createLayoutFormSections({
            layout: this.currentLayout,
            fieldInfoByApiName: this.objectInfoResult?.data?.fields,
            formRecordId: this.formRecordId
        });
    }

    get currentLayout() {
        return getCurrentLayout({
            formLayoutData: this.formLayoutResult?.data,
            objectApiName: this.config.objectApiName,
            layoutMode: this.layoutMode
        });
    }

    get fallbackFormSections() {
        return createFallbackFormSections({
            objectApiName: this.config?.objectApiName,
            nameFieldApiName: this.config?.nameFieldApiName
        });
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
        this.resetPagination();
    }

    handlePreviousPage() {
        if (this.previousDisabled) {
            return;
        }

        this.applyPaginationState(
            createPreviousPageState({
                pageNumber: this.pageNumber,
                pageTokenHistory: this.pageTokenHistory
            })
        );
    }

    handleNextPage() {
        if (this.nextDisabled) {
            return;
        }

        this.applyPaginationState(
            createNextPageState({
                pageNumber: this.pageNumber,
                pageTokenHistory: this.pageTokenHistory,
                nextPageToken: this.nextPageToken
            })
        );
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = normalizeSortDirection(sortDirection);
        this.resetPagination();
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
        const toastTitle = this.formRecordId ? '更新しました' : '作成しました';
        this.showToast(
            toastTitle,
            `${this.config.objectLabel}を保存しました。`,
            'success'
        );
        this.handleCloseRecordForm();
        await this.refreshRecordsAndNotifyChange();
    }

    async handleUploadFinished(event) {
        const uploadedCount = event.detail?.files?.length ?? 0;
        this.showToast(
            'アップロードしました',
            `${uploadedCount} 件のファイルを登録しました。`,
            'success'
        );
        this.handleCloseRecordForm();
        await this.refreshRecordsAndNotifyChange();
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
            await this.refreshRecordsAndNotifyChange();
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

    async refreshRecordsAndNotifyChange() {
        await refreshApex(this.wiredSearchResult);
        this.dispatchEvent(new CustomEvent('recordschanged'));
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

    isAccessError(error) {
        const status = error?.status ?? error?.body?.statusCode;
        if (status === 401 || status === 403) {
            return true;
        }

        return reduceErrors(error, '')
            .toLowerCase()
            .includes('insufficient access');
    }

    resetPagination() {
        this.applyPaginationState(createInitialPaginationState());
    }

    applyPaginationState(paginationState) {
        Object.assign(this, paginationState);
    }
}
