/**
 * Tests Account trigger service behavior.
 */
@IsTest
private with sharing class AccountTriggerServiceTest {
    @IsTest
    static void beforeInsertShouldNormalizeAccountNames() {
        // Given
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト')
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountTriggerService.beforeInsert(accounts);
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            '株式会社テスト',
            accounts[0].Name,
            'Before insert service should normalize Account names.'
        );
    }

    @IsTest
    static void beforeUpdateShouldNormalizeChangedAccountNames() {
        // Given
        Account accountRecord = TestDataFactory.insertAccount('テスト取引先');
        Account updatedAccount = new Account(
            Id = accountRecord.Id,
            Name = 'テスト（株）'
        );
        Map<Id, Account> oldAccountsById = new Map<Id, Account>{
            accountRecord.Id => accountRecord
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountTriggerService.beforeUpdate(
                new List<Account>{ updatedAccount },
                oldAccountsById
            );
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            'Before update service should normalize changed Account names.'
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
