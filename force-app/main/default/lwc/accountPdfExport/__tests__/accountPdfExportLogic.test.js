import {
    createPdfPageReference,
    isAccountRecordId
} from '../accountPdfExportLogic';

describe('accountPdfExportLogic', () => {
    it('accepts 15 and 18 character Account IDs', () => {
        expect(isAccountRecordId('001000000000001')).toBe(true);
        expect(isAccountRecordId('001000000000001AAA')).toBe(true);
    });

    it('rejects missing malformed and non-Account IDs', () => {
        expect(isAccountRecordId(undefined)).toBe(false);
        expect(isAccountRecordId('invalid-id')).toBe(false);
        expect(isAccountRecordId('003000000000001AAA')).toBe(false);
    });

    it('creates an encoded Visualforce web page reference', () => {
        expect(createPdfPageReference('001000000000001AAA')).toEqual({
            type: 'standard__webPage',
            attributes: {
                url: '/apex/AccountPdf?accountId=001000000000001AAA'
            }
        });
    });
});
