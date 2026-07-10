/**
 * 取引先トリガーによる名称補正テスト
 */
@IsTest
private with sharing class AccountTriggerHandlerTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenAccountsInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト'),
            TestDataFactory.createAccount('（株）テスト'),
            TestDataFactory.createAccount('(株)テスト'),
            TestDataFactory.createAccount('㈲テスト'),
            TestDataFactory.createAccount('（有）テスト'),
            TestDataFactory.createAccount('(有)テスト')
        };

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            insert accounts;

            Test.stopTest();
        }

        // 検証
        Map<Id, Account> accountsById = getAccountsById(accounts);
        Assert.areEqual(
            '株式会社テスト',
            accountsById.get(accounts[0].Id).Name,
            '㈱ should be normalized.'
        );
        Assert.areEqual(
            '株式会社テスト',
            accountsById.get(accounts[1].Id).Name,
            '（株） should be normalized.'
        );
        Assert.areEqual(
            '株式会社テスト',
            accountsById.get(accounts[2].Id).Name,
            '(株) should be normalized.'
        );
        Assert.areEqual(
            '有限会社テスト',
            accountsById.get(accounts[3].Id).Name,
            '㈲ should be normalized.'
        );
        Assert.areEqual(
            '有限会社テスト',
            accountsById.get(accounts[4].Id).Name,
            '（有） should be normalized.'
        );
        Assert.areEqual(
            '有限会社テスト',
            accountsById.get(accounts[5].Id).Name,
            '(有) should be normalized.'
        );
    }

    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenNameUpdated() {
        // 準備
        Account accountRecord = TestDataFactory.insertAccount('テスト取引先');
        accountRecord.Name = 'テスト（株）';

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            update accountRecord;

            Test.stopTest();
        }

        // 検証
        Account updatedAccount = getAccount(accountRecord);
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            'Updated Account name should be normalized.'
        );
    }

    @IsTest
    static void shouldKeepCompanyTypePositionWhenAccountsInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('テスト（株）'),
            TestDataFactory.createAccount('テスト(有)')
        };

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            insert accounts;

            Test.stopTest();
        }

        // 検証
        Map<Id, Account> accountsById = getAccountsById(accounts);
        Assert.areEqual(
            'テスト株式会社',
            accountsById.get(accounts[0].Id).Name,
            'Company type position should be preserved for stock company names.'
        );
        Assert.areEqual(
            'テスト有限会社',
            accountsById.get(accounts[1].Id).Name,
            'Company type position should be preserved for limited company names.'
        );
    }

    @IsTest
    static void shouldNormalizeMultipleCompanyAbbreviationsInAccountName() {
        // 準備
        Account accountRecord = TestDataFactory.createAccount(
            '㈱テスト(有)支店'
        );

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            insert accountRecord;

            Test.stopTest();
        }

        // 検証
        Account insertedAccount = getAccount(accountRecord);
        Assert.areEqual(
            '株式会社テスト有限会社支店',
            insertedAccount.Name,
            'All company abbreviations in the Account name should be normalized.'
        );
    }

    @IsTest
    static void shouldKeepFormalCompanyNamesWhenAlreadyNormalized() {
        // 準備
        Account accountRecord = TestDataFactory.createAccount('株式会社テスト');

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            insert accountRecord;

            Test.stopTest();
        }

        // 検証
        Account insertedAccount = getAccount(accountRecord);
        Assert.areEqual(
            '株式会社テスト',
            insertedAccount.Name,
            'Formal company name should not change.'
        );
    }

    @IsTest
    static void shouldKeepIncompleteAbbreviationsWhenAccountsInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('株）テスト'),
            TestDataFactory.createAccount('（株テスト'),
            TestDataFactory.createAccount('有)テスト'),
            TestDataFactory.createAccount('(有テスト')
        };

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            insert accounts;

            Test.stopTest();
        }

        // 検証
        Map<Id, Account> accountsById = getAccountsById(accounts);
        Assert.areEqual(
            '株）テスト',
            accountsById.get(accounts[0].Id).Name,
            'Incomplete stock company abbreviation should not be changed.'
        );
        Assert.areEqual(
            '（株テスト',
            accountsById.get(accounts[1].Id).Name,
            'Incomplete stock company abbreviation should not be changed.'
        );
        Assert.areEqual(
            '有)テスト',
            accountsById.get(accounts[2].Id).Name,
            'Incomplete limited company abbreviation should not be changed.'
        );
        Assert.areEqual(
            '(有テスト',
            accountsById.get(accounts[3].Id).Name,
            'Incomplete limited company abbreviation should not be changed.'
        );
    }

    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenBulkInserted() {
        // 準備
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 251; index++) {
            accounts.add(TestDataFactory.createAccount('㈱テスト ' + index));
        }

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            insert accounts;

            Test.stopTest();
        }

        // 検証
        List<Account> insertedAccounts = getAccounts(accounts);
        Assert.areEqual(
            251,
            insertedAccounts.size(),
            'All bulk Accounts should be inserted.'
        );
        for (Account accountRecord : insertedAccounts) {
            Assert.isTrue(
                accountRecord.Name.startsWith('株式会社テスト '),
                'Bulk Account name should be normalized.'
            );
        }
    }

    private static Account getAccount(Account accountRecord) {
        return getAccountsById(new List<Account>{ accountRecord })
            .get(accountRecord.Id);
    }

    private static Map<Id, Account> getAccountsById(List<Account> accounts) {
        return new Map<Id, Account>(getAccounts(accounts));
    }

    private static List<Account> getAccounts(List<Account> accounts) {
        Set<Id> accountIds = getAccountIds(accounts);
        return [
            SELECT Name
            FROM Account
            WHERE Id IN :accountIds
        ];
    }

    private static Set<Id> getAccountIds(List<Account> accounts) {
        Set<Id> accountIds = new Set<Id>();
        for (Account accountRecord : accounts) {
            accountIds.add(accountRecord.Id);
        }

        return accountIds;
    }
}