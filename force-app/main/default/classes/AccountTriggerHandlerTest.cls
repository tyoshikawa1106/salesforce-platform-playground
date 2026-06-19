/**
 * Tests Account trigger name normalization.
 */
@IsTest
private with sharing class AccountTriggerHandlerTest {
    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenAccountsInserted() {
        // Given
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト'),
            TestDataFactory.createAccount('（株）テスト'),
            TestDataFactory.createAccount('(株)テスト'),
            TestDataFactory.createAccount('㈲テスト'),
            TestDataFactory.createAccount('（有）テスト'),
            TestDataFactory.createAccount('(有)テスト')
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            insert accounts;
            Test.stopTest();
        }

        // Then
        Set<Id> accountIds = getAccountIds(accounts);
        Map<Id, Account> accountsById = new Map<Id, Account>(
            [SELECT Name FROM Account WHERE Id IN :accountIds]
        );
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
        // Given
        Account accountRecord = TestDataFactory.insertAccount('テスト取引先');
        accountRecord.Name = 'テスト（株）';

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            update accountRecord;
            Test.stopTest();
        }

        // Then
        Account updatedAccount = [
            SELECT Name
            FROM Account
            WHERE Id = :accountRecord.Id
            LIMIT 1
        ];
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            'Updated Account name should be normalized.'
        );
    }

    @IsTest
    static void shouldKeepCompanyTypePositionWhenAccountsInserted() {
        // Given
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('テスト（株）'),
            TestDataFactory.createAccount('テスト(有)')
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            insert accounts;
            Test.stopTest();
        }

        // Then
        Set<Id> accountIds = getAccountIds(accounts);
        Map<Id, Account> accountsById = new Map<Id, Account>(
            [SELECT Name FROM Account WHERE Id IN :accountIds]
        );
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
        // Given
        Account accountRecord = TestDataFactory.createAccount(
            '㈱テスト(有)支店'
        );

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            insert accountRecord;
            Test.stopTest();
        }

        // Then
        Account insertedAccount = [
            SELECT Name
            FROM Account
            WHERE Id = :accountRecord.Id
            LIMIT 1
        ];
        Assert.areEqual(
            '株式会社テスト有限会社支店',
            insertedAccount.Name,
            'All company abbreviations in the Account name should be normalized.'
        );
    }

    @IsTest
    static void shouldKeepFormalCompanyNamesWhenAlreadyNormalized() {
        // Given
        Account accountRecord = TestDataFactory.createAccount('株式会社テスト');

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            insert accountRecord;
            Test.stopTest();
        }

        // Then
        Account insertedAccount = [
            SELECT Name
            FROM Account
            WHERE Id = :accountRecord.Id
            LIMIT 1
        ];
        Assert.areEqual(
            '株式会社テスト',
            insertedAccount.Name,
            'Formal company name should not change.'
        );
    }

    @IsTest
    static void shouldKeepIncompleteAbbreviationsWhenAccountsInserted() {
        // Given
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('株）テスト'),
            TestDataFactory.createAccount('（株テスト'),
            TestDataFactory.createAccount('有)テスト'),
            TestDataFactory.createAccount('(有テスト')
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            insert accounts;
            Test.stopTest();
        }

        // Then
        Set<Id> accountIds = getAccountIds(accounts);
        Map<Id, Account> accountsById = new Map<Id, Account>(
            [SELECT Name FROM Account WHERE Id IN :accountIds]
        );
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
        // Given
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 251; index++) {
            accounts.add(TestDataFactory.createAccount('㈱テスト ' + index));
        }

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            insert accounts;
            Test.stopTest();
        }

        // Then
        Set<Id> accountIds = getAccountIds(accounts);
        List<Account> insertedAccounts = [
            SELECT Name
            FROM Account
            WHERE Id IN :accountIds
        ];
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

    private static Set<Id> getAccountIds(List<Account> accounts) {
        Set<Id> accountIds = new Set<Id>();
        for (Account accountRecord : accounts) {
            accountIds.add(accountRecord.Id);
        }

        return accountIds;
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
