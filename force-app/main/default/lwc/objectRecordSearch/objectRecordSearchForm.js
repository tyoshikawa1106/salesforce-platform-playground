export const FORM_MODE_RECORD = 'record';
export const FORM_MODE_FILE_UPLOAD = 'fileUpload';

const FORM_MODE_UNSUPPORTED = 'unsupported';
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

export function getObjectUiCapability(objectApiName) {
    return OBJECT_UI_CAPABILITIES[objectApiName] ?? DEFAULT_OBJECT_UI_CAPABILITY;
}

export function getCurrentLayout({ formLayoutData, objectApiName, layoutMode }) {
    if (!formLayoutData) {
        return undefined;
    }

    return (
        formLayoutData.layouts?.[objectApiName]?.Full?.[layoutMode] ??
        formLayoutData
    );
}

export function createLayoutFormSections({
    layout,
    fieldInfoByApiName = {},
    formRecordId
} = {}) {
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
                        !isEditableLayoutItem(item, formRecordId) ||
                        !isSupportedStandardField(fieldInfo, formRecordId)
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
                createFormSection(
                    section.heading || section.label || DEFAULT_FORM_SECTION_LABEL,
                    fields,
                    index
                )
            );
        }
    });

    return sections;
}

export function applyFormFieldOverrides({
    sections,
    objectApiName,
    fieldInfoByApiName = {},
    formRecordId
} = {}) {
    const configuredFields = FORM_FIELD_OVERRIDES[objectApiName] ?? [];
    if (configuredFields.length === 0) {
        return sections;
    }

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
            isSupportedStandardField(fieldInfo, formRecordId)
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

export function createFallbackFormSections({
    objectApiName,
    nameFieldApiName
} = {}) {
    const configuredFields = FORM_FIELD_OVERRIDES[objectApiName];
    if (configuredFields) {
        return [
            createFormSection(DEFAULT_FORM_SECTION_LABEL, configuredFields, 0)
        ];
    }

    if (!nameFieldApiName) {
        return [];
    }

    return [
        createFormSection(
            DEFAULT_FORM_SECTION_LABEL,
            [
                {
                    apiName: nameFieldApiName,
                    required: true
                }
            ],
            0
        )
    ];
}

function createFormSection(label, fields, index) {
    const key = `section-${index}`;
    return {
        key,
        headingId: `object-record-form-${key}`,
        label: label || DEFAULT_FORM_SECTION_LABEL,
        fields
    };
}

function isEditableLayoutItem(item, formRecordId) {
    return formRecordId ? item.editableForUpdate : item.editableForNew;
}

function isSupportedStandardField(fieldInfo, formRecordId) {
    if (!fieldInfo || fieldInfo.custom) {
        return false;
    }

    return formRecordId ? fieldInfo.updateable : fieldInfo.createable;
}
