const BASE_NAME_COLUMN = {
    label: 'Name',
    fieldName: 'recordUrl',
    type: 'url',
    sortable: true,
    typeAttributes: {
        label: { fieldName: 'name' },
        target: '_self'
    }
};

const DISPLAY_FIELD_PREFIX = 'displayField_';
const ROW_ACTIONS = [{ label: '編集', name: 'edit' }];

export function createColumns({
    nameFieldLabel = 'Name',
    displayFields = [],
    editDisabled = true
} = {}) {
    const columns = [
        {
            ...BASE_NAME_COLUMN,
            label: nameFieldLabel,
            initialWidth: 220
        },
        ...displayFields.map((field) => createDisplayFieldColumn(field))
    ];

    if (!editDisabled) {
        columns.push({
            type: 'action',
            typeAttributes: { rowActions: ROW_ACTIONS }
        });
    }

    return columns;
}

export function createDisplayRow(record, displayFields = []) {
    const displayValues = {};
    const fieldValues = record.fieldValues ?? {};
    displayFields.forEach((field) => {
        displayValues[getDisplayFieldName(field.apiName)] =
            fieldValues[field.apiName] ?? '';
    });

    return {
        ...record,
        ...displayValues
    };
}

export function getSortFieldApiName({
    sortedBy,
    nameFieldApiName = 'Name'
} = {}) {
    if (sortedBy === 'recordUrl') {
        return nameFieldApiName;
    }

    return getApiNameFromDisplayFieldName(sortedBy, nameFieldApiName);
}

function createDisplayFieldColumn(field) {
    const fieldName = getDisplayFieldName(field.apiName);
    const type = getDisplayFieldType(field.apiName);
    const column = {
        label: field.label,
        fieldName,
        type,
        sortable: true,
        wrapText: true,
        initialWidth: 180
    };

    if (type === 'url') {
        column.typeAttributes = {
            label: { fieldName },
            target: '_blank'
        };
    }

    return column;
}

function getDisplayFieldType(apiName) {
    if (isUrlField(apiName)) {
        return 'url';
    }

    if (isEmailField(apiName)) {
        return 'email';
    }

    if (isPhoneField(apiName)) {
        return 'phone';
    }

    return 'text';
}

function isUrlField(apiName) {
    const normalizedApiName = apiName.toLowerCase();
    return normalizedApiName === 'website' || normalizedApiName.endsWith('url');
}

function isEmailField(apiName) {
    const normalizedApiName = apiName.toLowerCase();
    return (
        normalizedApiName.endsWith('email') ||
        normalizedApiName === 'fromaddress' ||
        normalizedApiName === 'toaddress'
    );
}

function isPhoneField(apiName) {
    return apiName.toLowerCase().endsWith('phone');
}

function getDisplayFieldName(apiName) {
    return `${DISPLAY_FIELD_PREFIX}${apiName}`;
}

function getApiNameFromDisplayFieldName(fieldName, fallbackApiName) {
    if (fieldName?.startsWith(DISPLAY_FIELD_PREFIX)) {
        return fieldName.slice(DISPLAY_FIELD_PREFIX.length);
    }

    return fallbackApiName;
}
