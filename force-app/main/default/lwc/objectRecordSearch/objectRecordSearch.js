import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import searchRecords from '@salesforce/apex/ObjectRecordSearchController.searchRecords';
import deleteRecords from '@salesforce/apex/ObjectRecordSearchController.deleteRecords';

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

export default class ObjectRecordSearch extends LightningElement {
    @api metricKey;

    draftSearchTerm = '';
    searchTerm = '';
    rows = [];
    selectedRowIds = [];
    config;
    errorMessage;
    isDeleting = false;
    wiredSearchResult;

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
            this.errorMessage = this.reduceErrors(error);
        }
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
        return [
            {
                ...BASE_COLUMNS[0],
                label: nameFieldLabel
            },
            ...BASE_COLUMNS.slice(1)
        ];
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
        return this.isLoading || this.isDeleting;
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
                    result.errors.join('\n'),
                    'warning'
                );
            }
            await refreshApex(this.wiredSearchResult);
            this.dispatchEvent(new CustomEvent('recordsdeleted'));
        } catch (error) {
            this.errorMessage = this.reduceErrors(error);
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

    reduceErrors(errors) {
        const normalizedErrors = Array.isArray(errors) ? errors : [errors];
        return normalizedErrors
            .filter((error) => error)
            .map((error) => {
                if (Array.isArray(error.body)) {
                    return error.body
                        .map((bodyError) => bodyError.message)
                        .join(', ');
                }
                if (error.body?.message) {
                    return error.body.message;
                }
                if (error.message) {
                    return error.message;
                }
                return 'レコード一覧を読み込めませんでした。';
            })
            .join('; ');
    }
}
