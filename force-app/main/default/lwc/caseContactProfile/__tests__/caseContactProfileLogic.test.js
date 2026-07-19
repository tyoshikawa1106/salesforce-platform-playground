import {
    createProfile,
    formatCaseCount
} from '../caseContactProfileLogic';

describe('caseContactProfileLogic', () => {
    it('ContactとCase Accountを優先してプロフィールを生成する', () => {
        expect(
            createProfile({
                contactId: '003000000000001',
                caseAccountId: '001000000000001',
                contactAccountId: '001000000000002',
                contactName: '山田 太郎',
                suppliedName: 'Web 氏名',
                contactEmail: 'contact@example.com',
                suppliedEmail: 'web@example.com',
                contactPhone: '03-0000-0000',
                suppliedPhone: '090-0000-0000',
                contactMobilePhone: '080-0000-0000',
                contactFax: '03-0000-0001',
                caseAccountName: '取引先A',
                contactAccountName: '取引先B',
                suppliedCompany: 'Web会社',
                caseAccountWebsite: 'https://case.example.com',
                contactAccountWebsite: 'https://contact.example.com',
                contactDepartment: '営業部',
                contactTitle: '部長'
            })
        ).toEqual(
            expect.objectContaining({
                contactId: '003000000000001',
                accountId: '001000000000001',
                contactName: '山田 太郎',
                contactEmail: 'contact@example.com',
                contactPhone: '03-0000-0000',
                contactMobilePhone: '080-0000-0000',
                contactFax: '03-0000-0001',
                companyName: '取引先A',
                website: 'https://case.example.com',
                department: '営業部',
                title: '部長'
            })
        );
    });

    it('ContactとAccountがない場合はWeb入力と代替値を使用する', () => {
        expect(
            createProfile({
                suppliedName: 'Web 氏名',
                suppliedEmail: 'web@example.com',
                suppliedPhone: '090-0000-0000',
                suppliedCompany: 'Web会社'
            })
        ).toEqual(
            expect.objectContaining({
                contactId: undefined,
                accountId: undefined,
                contactName: 'Web 氏名',
                contactEmail: 'web@example.com',
                contactEmailText: 'web@example.com',
                contactPhone: '090-0000-0000',
                contactMobilePhone: undefined,
                contactMobilePhoneText: '-',
                contactFax: undefined,
                contactFaxText: '-',
                companyName: 'Web会社',
                website: undefined,
                websiteText: '-',
                department: '-',
                title: '-'
            })
        );
    });

    it('問い合わせ件数を未取得時の代替値を含む表示へ変換する', () => {
        expect(formatCaseCount(0)).toBe(0);
        expect(formatCaseCount(12)).toBe(12);
        expect(formatCaseCount(undefined)).toBe('-');
    });
});
