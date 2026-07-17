import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import CASE_ACCOUNT_ID_FIELD from '@salesforce/schema/Case.AccountId';
import CASE_ACCOUNT_NAME_FIELD from '@salesforce/schema/Case.Account.Name';
import CASE_ACCOUNT_WEBSITE_FIELD from '@salesforce/schema/Case.Account.Website';
import CASE_CONTACT_ID_FIELD from '@salesforce/schema/Case.ContactId';
import CASE_CONTACT_ACCOUNT_ID_FIELD from '@salesforce/schema/Case.Contact.AccountId';
import CASE_CONTACT_NAME_FIELD from '@salesforce/schema/Case.Contact.Name';
import CASE_CONTACT_EMAIL_FIELD from '@salesforce/schema/Case.Contact.Email';
import CASE_CONTACT_PHONE_FIELD from '@salesforce/schema/Case.Contact.Phone';
import CASE_CONTACT_MOBILE_PHONE_FIELD from '@salesforce/schema/Case.Contact.MobilePhone';
import CASE_CONTACT_FAX_FIELD from '@salesforce/schema/Case.Contact.Fax';
import CASE_CONTACT_DEPARTMENT_FIELD from '@salesforce/schema/Case.Contact.Department';
import CASE_CONTACT_TITLE_FIELD from '@salesforce/schema/Case.Contact.Title';
import CASE_CONTACT_ACCOUNT_NAME_FIELD from '@salesforce/schema/Case.Contact.Account.Name';
import CASE_CONTACT_ACCOUNT_WEBSITE_FIELD from '@salesforce/schema/Case.Contact.Account.Website';
import CASE_SUPPLIED_NAME_FIELD from '@salesforce/schema/Case.SuppliedName';
import CASE_SUPPLIED_EMAIL_FIELD from '@salesforce/schema/Case.SuppliedEmail';
import CASE_SUPPLIED_PHONE_FIELD from '@salesforce/schema/Case.SuppliedPhone';
import CASE_SUPPLIED_COMPANY_FIELD from '@salesforce/schema/Case.SuppliedCompany';

const REQUIRED_FIELDS = [CASE_CONTACT_ID_FIELD];
const OPTIONAL_FIELDS = [
    CASE_ACCOUNT_ID_FIELD,
    CASE_ACCOUNT_NAME_FIELD,
    CASE_ACCOUNT_WEBSITE_FIELD,
    CASE_CONTACT_ACCOUNT_ID_FIELD,
    CASE_CONTACT_NAME_FIELD,
    CASE_CONTACT_EMAIL_FIELD,
    CASE_CONTACT_PHONE_FIELD,
    CASE_CONTACT_MOBILE_PHONE_FIELD,
    CASE_CONTACT_FAX_FIELD,
    CASE_CONTACT_DEPARTMENT_FIELD,
    CASE_CONTACT_TITLE_FIELD,
    CASE_CONTACT_ACCOUNT_NAME_FIELD,
    CASE_CONTACT_ACCOUNT_WEBSITE_FIELD,
    CASE_SUPPLIED_NAME_FIELD,
    CASE_SUPPLIED_EMAIL_FIELD,
    CASE_SUPPLIED_PHONE_FIELD,
    CASE_SUPPLIED_COMPANY_FIELD
];
const UNAVAILABLE_VALUE = '-';
const CONTACT_OBJECT_API_NAME = 'Contact';
const ACCOUNT_OBJECT_API_NAME = 'Account';

export default class CaseContactProfile extends NavigationMixin(
    LightningElement
) {
    @api recordId;

    caseRecord;
    errorMessage;
    hasLoaded = false;
    contactRecordUrl;
    accountRecordUrl;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: REQUIRED_FIELDS,
        optionalFields: OPTIONAL_FIELDS
    })
    wiredCase({ data, error }) {
        if (data) {
            this.hasLoaded = true;
            this.caseRecord = data;
            this.errorMessage = undefined;
            this.updateRecordUrls();
        } else if (error) {
            this.hasLoaded = true;
            this.caseRecord = undefined;
            this.contactRecordUrl = undefined;
            this.accountRecordUrl = undefined;
            this.errorMessage =
                '取引先責任者のプロフィールを読み込めませんでした。時間をおいてもう一度お試しください。';
        }
    }

    get isLoading() {
        return !this.hasLoaded;
    }

    get contactId() {
        return this.getValue(CASE_CONTACT_ID_FIELD);
    }

    get caseAccountId() {
        return this.getValue(CASE_ACCOUNT_ID_FIELD);
    }

    get contactAccountId() {
        return this.getValue(CASE_CONTACT_ACCOUNT_ID_FIELD);
    }

    get accountId() {
        return this.caseAccountId || this.contactAccountId;
    }

    get contactName() {
        return this.getDisplayValue(
            this.getContactValue(
                CASE_CONTACT_NAME_FIELD,
                CASE_SUPPLIED_NAME_FIELD
            )
        );
    }

    get contactEmail() {
        return this.getContactValue(
            CASE_CONTACT_EMAIL_FIELD,
            CASE_SUPPLIED_EMAIL_FIELD
        );
    }

    get contactEmailText() {
        return this.contactEmail || UNAVAILABLE_VALUE;
    }

    get contactPhone() {
        return this.getContactValue(
            CASE_CONTACT_PHONE_FIELD,
            CASE_SUPPLIED_PHONE_FIELD
        );
    }

    get contactPhoneText() {
        return this.contactPhone || UNAVAILABLE_VALUE;
    }

    get contactMobilePhone() {
        return this.getContactValue(CASE_CONTACT_MOBILE_PHONE_FIELD);
    }

    get contactMobilePhoneText() {
        return this.contactMobilePhone || UNAVAILABLE_VALUE;
    }

    get contactFax() {
        return this.getContactValue(CASE_CONTACT_FAX_FIELD);
    }

    get contactFaxText() {
        return this.contactFax || UNAVAILABLE_VALUE;
    }

    get companyName() {
        if (this.caseAccountId) {
            return this.getDisplayValue(CASE_ACCOUNT_NAME_FIELD);
        }
        if (this.contactAccountId) {
            return this.getDisplayValue(
                CASE_CONTACT_ACCOUNT_NAME_FIELD
            );
        }
        return this.getDisplayValue(CASE_SUPPLIED_COMPANY_FIELD);
    }

    get website() {
        if (this.caseAccountId) {
            return this.getValue(CASE_ACCOUNT_WEBSITE_FIELD);
        }
        if (this.contactAccountId) {
            return this.getValue(CASE_CONTACT_ACCOUNT_WEBSITE_FIELD);
        }
        return undefined;
    }

    get websiteText() {
        return this.website || UNAVAILABLE_VALUE;
    }

    get department() {
        return this.getDisplayValue(
            this.getContactValue(CASE_CONTACT_DEPARTMENT_FIELD)
        );
    }

    get title() {
        return this.getDisplayValue(
            this.getContactValue(CASE_CONTACT_TITLE_FIELD)
        );
    }

    getValue(field) {
        return getFieldValue(this.caseRecord, field);
    }

    getDisplayValue(valueOrField) {
        const value =
            valueOrField && typeof valueOrField === 'object'
                ? this.getValue(valueOrField)
                : valueOrField;
        return value || UNAVAILABLE_VALUE;
    }

    getContactValue(contactField, suppliedField) {
        if (this.contactId) {
            return this.getValue(contactField);
        }
        return suppliedField ? this.getValue(suppliedField) : undefined;
    }

    async updateRecordUrls() {
        const contactId = this.contactId;
        const accountId = this.accountId;
        const [contactRecordUrl, accountRecordUrl] = await Promise.all([
            this.generateRecordUrl(contactId, CONTACT_OBJECT_API_NAME),
            this.generateRecordUrl(accountId, ACCOUNT_OBJECT_API_NAME)
        ]);

        if (contactId === this.contactId && accountId === this.accountId) {
            this.contactRecordUrl = contactRecordUrl;
            this.accountRecordUrl = accountRecordUrl;
        }
    }

    generateRecordUrl(recordId, objectApiName) {
        if (!recordId) {
            return Promise.resolve(undefined);
        }
        return this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId,
                objectApiName,
                actionName: 'view'
            }
        }).catch(() => undefined);
    }
}
