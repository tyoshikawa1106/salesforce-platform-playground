import { createElement } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import CaseContactProfile from 'c/caseContactProfile';

const CASE_RECORD_ID = '500000000000001AAA';

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const createComponent = () => {
    const element = createElement('c-case-contact-profile', {
        is: CaseContactProfile
    });
    element.recordId = CASE_RECORD_ID;
    document.body.appendChild(element);
    return element;
};

const createCaseRecord = ({
    contactId = '003000000000001AAA',
    contactName = '山田 太郎',
    contactEmail = 'taro@example.com',
    contactPhone = '03-1234-5678',
    contactMobilePhone = '090-1234-5678',
    contactFax = '03-1234-5679',
    caseAccountId = '001000000000001AAA',
    caseCompanyName = 'ケース取引先株式会社',
    caseWebsite = 'https://case-account.example.com',
    contactAccountId = caseAccountId,
    contactCompanyName = '取引先責任者取引先株式会社',
    contactWebsite = 'https://contact-account.example.com',
    department = 'カスタマーサクセス部',
    title = '部長',
    suppliedName = 'Web 山田',
    suppliedEmail = 'web@example.com',
    suppliedPhone = '06-1234-5678',
    suppliedCompany = 'Web サンプル株式会社'
} = {}) => ({
    apiName: 'Case',
    fields: {
        ContactId: { value: contactId },
        AccountId: { value: caseAccountId },
        Account: {
            value: caseAccountId
                ? {
                      apiName: 'Account',
                      fields: {
                          Name: { value: caseCompanyName },
                          Website: { value: caseWebsite }
                      }
                  }
                : null
        },
        SuppliedName: { value: suppliedName },
        SuppliedEmail: { value: suppliedEmail },
        SuppliedPhone: { value: suppliedPhone },
        SuppliedCompany: { value: suppliedCompany },
        Contact: {
            value: contactId
                ? {
                      apiName: 'Contact',
                      fields: {
                          Name: { value: contactName },
                          Email: { value: contactEmail },
                          Phone: { value: contactPhone },
                          MobilePhone: { value: contactMobilePhone },
                          Fax: { value: contactFax },
                          Department: { value: department },
                          Title: { value: title },
                          AccountId: { value: contactAccountId },
                          Account: {
                              value: contactAccountId
                                  ? {
                                        apiName: 'Account',
                                        fields: {
                                            Name: { value: contactCompanyName },
                                            Website: { value: contactWebsite }
                                        }
                                    }
                                  : null
                          }
                      }
                  }
                : null
        }
    },
    id: CASE_RECORD_ID
});

describe('c-case-contact-profile', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders only the loading state before the wire responds', async () => {
        const element = createComponent();
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('lightning-spinner')
        ).not.toBeNull();
        expect(element.shadowRoot.querySelector('dl')).toBeNull();
    });

    it('renders the contact profile fields and person icon', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord());
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('山田 太郎');
        expect(element.shadowRoot.textContent).toContain(
            'ケース取引先株式会社'
        );
        expect(element.shadowRoot.textContent).toContain(
            'カスタマーサクセス部'
        );
        expect(element.shadowRoot.textContent).toContain('部長');
        expect(
            element.shadowRoot.querySelector('lightning-formatted-email').value
        ).toBe('taro@example.com');
        expect(
            element.shadowRoot.querySelector('lightning-formatted-phone').value
        ).toBe('03-1234-5678');
        expect(
            element.shadowRoot.querySelector('lightning-formatted-url').value
        ).toBe('https://case-account.example.com');
        expect(
            [
                ...element.shadowRoot.querySelectorAll(
                    'lightning-formatted-phone'
                )
            ].map((phone) => phone.value)
        ).toEqual([
            '03-1234-5678',
            '090-1234-5678',
            '03-1234-5679'
        ]);
        expect(element.shadowRoot.querySelector('lightning-icon').iconName).toBe(
            'utility:profile_alt'
        );
        expect(element.shadowRoot.querySelector('lightning-card')).toBeNull();
        expect(element.shadowRoot.querySelectorAll('a')).toHaveLength(2);
        await expect(element).toBeAccessible();
    });

    it('renders Web-to-Case values without record links', async () => {
        const element = createComponent();

        getRecord.emit(
            createCaseRecord({
                contactId: null,
                caseAccountId: null,
                contactAccountId: null
            })
        );
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain('Web 山田');
        expect(element.shadowRoot.textContent).toContain(
            'Web サンプル株式会社'
        );
        expect(
            element.shadowRoot.querySelector('lightning-formatted-email').value
        ).toBe('web@example.com');
        expect(
            element.shadowRoot.querySelector('lightning-formatted-phone').value
        ).toBe('06-1234-5678');
        expect(element.shadowRoot.querySelectorAll('a')).toHaveLength(0);
        await expect(element).toBeAccessible();
    });

    it('prioritizes the case account over the contact account', async () => {
        const element = createComponent();

        getRecord.emit(createCaseRecord());
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'ケース取引先株式会社'
        );
        expect(element.shadowRoot.textContent).not.toContain(
            '取引先責任者取引先株式会社'
        );
        expect(
            element.shadowRoot.querySelector('lightning-formatted-url').value
        ).toBe('https://case-account.example.com');
        await expect(element).toBeAccessible();
    });

    it('uses the contact account when the case has no account', async () => {
        const element = createComponent();

        getRecord.emit(
            createCaseRecord({
                caseAccountId: null,
                contactAccountId: '001000000000002AAA'
            })
        );
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            '取引先責任者取引先株式会社'
        );
        expect(
            element.shadowRoot.querySelector('lightning-formatted-url').value
        ).toBe('https://contact-account.example.com');
        expect(element.shadowRoot.querySelectorAll('a')).toHaveLength(2);
        await expect(element).toBeAccessible();
    });

    it('renders hyphens for unavailable optional fields', async () => {
        const element = createComponent();

        getRecord.emit(
            createCaseRecord({
                contactEmail: null,
                contactPhone: null,
                contactMobilePhone: null,
                contactFax: null,
                caseAccountId: null,
                contactAccountId: null,
                caseCompanyName: null,
                contactCompanyName: null,
                department: null,
                title: null,
                suppliedCompany: null,
                caseWebsite: null,
                contactWebsite: null
            })
        );
        await flushPromises();

        expect(element.shadowRoot.textContent.match(/-/g)).toHaveLength(8);
        await expect(element).toBeAccessible();
    });

    it('renders an accessible error when the record cannot be loaded', async () => {
        const element = createComponent();

        getRecord.error({ body: { message: 'Record load failed' } });
        await flushPromises();

        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert.textContent).toContain(
            '取引先責任者のプロフィールを読み込めませんでした。'
        );
        await expect(element).toBeAccessible();
    });
});
