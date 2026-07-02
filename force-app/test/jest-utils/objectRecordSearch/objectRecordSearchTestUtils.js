import { createElement } from 'lwc';
import ObjectRecordSearch from 'c/objectRecordSearch';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getLayout } from 'lightning/uiLayoutApi';

export const searchResponse = {
    config: {
        metricKey: 'accounts',
        objectApiName: 'Account',
        objectLabel: '取引先',
        nameFieldApiName: 'Name',
        nameFieldLabel: '取引先名',
        deletable: true,
        createable: true,
        updateable: true,
        searchable: true,
        nameFieldCreateable: true,
        nameFieldUpdateable: true,
        displayFields: [
            { apiName: 'Industry', label: '業種', dataType: 'text' },
            { apiName: 'Type', label: '種別', dataType: 'text' },
            { apiName: 'Website', label: 'Webサイト', dataType: 'url' },
            { apiName: 'Phone', label: '電話', dataType: 'phone' },
            { apiName: 'BillingState', label: '都道府県', dataType: 'text' },
            { apiName: 'BillingCity', label: '市区郡', dataType: 'text' }
        ]
    },
    records: [
        {
            id: '001xx000003DGbYAAW',
            name: 'Acme',
            recordUrl: '/lightning/r/Account/001xx000003DGbYAAW/view',
            fieldValues: {
                Industry: 'Technology',
                Type: 'Prospect',
                Website: 'https://example.com',
                Phone: '03-5555-0001',
                BillingState: '東京都',
                BillingCity: '千代田区'
            }
        }
    ],
    pageSize: 50,
    pageNumber: 1,
    hasNextPage: false,
    nextPageToken: null
};

export function createSearchResponse(configOverrides = {}) {
    return {
        ...searchResponse,
        config: {
            ...searchResponse.config,
            ...configOverrides
        }
    };
}

export function createComponent() {
    const element = createElement('c-object-record-search', {
        is: ObjectRecordSearch
    });
    element.metricKey = 'accounts';
    document.body.appendChild(element);
    return element;
}

export async function flushPromises() {
    await Promise.resolve();
}

export function emitObjectInfo(fieldOverrides = {}) {
    getObjectInfo.emit({
        defaultRecordTypeId: '012000000000000AAA',
        fields: {
            Name: createFieldInfo(),
            Industry: createFieldInfo(),
            FirstName: createFieldInfo(),
            LastName: createFieldInfo(),
            Company: createFieldInfo(),
            StageName: createFieldInfo(),
            CloseDate: createFieldInfo(),
            Custom_Text__c: createFieldInfo({ custom: true }),
            ...fieldOverrides
        }
    });
}

export function emitLayout({
    objectApiName = 'Account',
    mode = 'Create',
    fields = ['Name', 'Industry'],
    sections
} = {}) {
    const layoutSections = (sections ?? [{ heading: '基本情報', fields }]).map((section) => ({
        heading: section.heading,
        layoutRows: [
            {
                layoutItems: section.fields.map((field) => ({
                    editableForNew: true,
                    editableForUpdate: true,
                    required: true,
                    layoutComponents: [
                        {
                            apiName: field,
                            componentType: 'Field'
                        }
                    ]
                }))
            }
        ]
    }));

    getLayout.emit({
        layouts: {
            [objectApiName]: {
                Full: {
                    [mode]: {
                        sections: layoutSections
                    }
                }
            }
        }
    });
}

export function findButton(element, label) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button) => button.label === label);
}

function createFieldInfo(overrides = {}) {
    return {
        custom: false,
        createable: true,
        updateable: true,
        ...overrides
    };
}
