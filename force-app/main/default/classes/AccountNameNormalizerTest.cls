/**
 * Tests Account name normalization behavior.
 */
@IsTest
private with sharing class AccountNameNormalizerTest {
    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenAccountsProvided() {
        // Given
        List<SObject> accounts = new List<SObject>{
            TestDataFactory.createAccount('㈱テスト'),
            TestDataFactory.createAccount('テスト(有)支店')
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountNameNormalizer.normalize(accounts, null);
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            '株式会社テスト',
            ((Account) accounts[0]).Name,
            'Stock company abbreviation should be normalized.'
        );
        Assert.areEqual(
            'テスト有限会社支店',
            ((Account) accounts[1]).Name,
            'Limited company abbreviation should be normalized.'
        );
    }

    @IsTest
    static void shouldSkipNormalizationWhenNameDidNotChange() {
        // Given
        Account savedAccount = TestDataFactory.insertAccount('テスト取引先');
        Account accountRecord = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );
        Account oldAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );
        Map<Id, SObject> oldAccountsById = new Map<Id, SObject>{
            accountRecord.Id => oldAccount
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountNameNormalizer.normalize(
                new List<SObject>{ accountRecord },
                oldAccountsById
            );
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            '㈱テスト',
            accountRecord.Name,
            'Unchanged Account names should not be normalized during update handling.'
        );
    }

    @IsTest
    static void shouldDoNothingWhenAccountsEmpty() {
        // Given
        List<SObject> accounts = new List<SObject>();

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountNameNormalizer.normalize(accounts, null);
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            0,
            accounts.size(),
            'Empty input should remain empty.'
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
