const FIRST_PAGE_NUMBER = 1;

export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_SORTED_BY = 'recordUrl';
export const DEFAULT_SORT_DIRECTION = 'asc';

export function createInitialPaginationState() {
    return {
        pageNumber: FIRST_PAGE_NUMBER,
        pageSize: DEFAULT_PAGE_SIZE,
        currentPageToken: undefined,
        nextPageToken: undefined,
        pageTokenHistory: [],
        hasNextPage: false
    };
}

export function createPaginationStateFromResponse(data, currentPageSize) {
    return {
        pageNumber: data.pageNumber ?? FIRST_PAGE_NUMBER,
        pageSize: data.pageSize ?? currentPageSize ?? DEFAULT_PAGE_SIZE,
        nextPageToken: data.nextPageToken,
        hasNextPage: Boolean(data.hasNextPage)
    };
}

export function createPreviousPageState({ pageNumber, pageTokenHistory }) {
    const previousHistory = pageTokenHistory.slice(0, -1);
    return {
        pageNumber: pageNumber - 1,
        currentPageToken: previousHistory[previousHistory.length - 1],
        pageTokenHistory: previousHistory
    };
}

export function createNextPageState({
    pageNumber,
    pageTokenHistory,
    nextPageToken
}) {
    return {
        pageNumber: pageNumber + 1,
        currentPageToken: nextPageToken,
        pageTokenHistory: [...pageTokenHistory, nextPageToken]
    };
}

export function normalizeSortDirection(sortDirection) {
    return sortDirection === 'desc' ? 'desc' : 'asc';
}

export function createAccessMessages({
    config,
    formCapabilityMessage,
    isFileUploadObject,
    isRecordFormObject,
    shouldShowFormFieldMessage,
    hasFormLayoutError
}) {
    if (!config) {
        return [];
    }

    const messages = [];
    const objectLabel = config.objectLabel ?? 'レコード';
    addMessage(messages, 'form-capability', formCapabilityMessage);

    if (!config.searchable) {
        addMessage(
            messages,
            'searchable',
            `${objectLabel}の検索対象項目を参照できないため、検索条件を使えません。`
        );
    }

    if (!config.createable && !isFileUploadObject) {
        addMessage(
            messages,
            'createable',
            `${objectLabel}を作成する権限がありません。`
        );
    }

    if (!config.updateable && isRecordFormObject) {
        addMessage(
            messages,
            'updateable',
            `${objectLabel}を編集する権限がありません。`
        );
    }

    if (!config.deletable) {
        addMessage(
            messages,
            'deletable',
            `${objectLabel}を削除する権限がありません。`
        );
    }

    if (shouldShowFormFieldMessage) {
        addMessage(
            messages,
            'form-fields',
            `${objectLabel}の作成・編集に使える標準項目がありません。`
        );
    }

    if (hasFormLayoutError && isRecordFormObject) {
        addMessage(
            messages,
            'layout-fallback',
            'ページレイアウトを取得できないため、標準の入力項目で表示します。'
        );
    }

    return messages;
}

function addMessage(messages, key, message) {
    if (message) {
        messages.push({ key, message });
    }
}