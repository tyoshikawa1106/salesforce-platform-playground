/**
 * 取引先トリガーサービスの振る舞いをテストします。
 */
@IsTest
private with sharing class AccountTriggerServiceTest {
    @IsTest
    static void beforeInsertShouldNormalizeAccountNames() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト'),
            TestDataFactory.createAccount('テスト(有)支店')
        };

        // 実行
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountTriggerService.beforeInsert(accounts);
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            accounts[0].Name,
            'Before insert service should normalize Account names.'
        );
        Assert.areEqual(
            'テスト有限会社支店',
            accounts[1].Name,
            'Before insert service should normalize limited company names.'
        );
    }

    @IsTest
    static void beforeUpdateShouldNormalizeChangedAccountNames() {
        // 準備
        Account accountRecord = TestDataFactory.insertAccount('テスト取引先');
        Account updatedAccount = new Account(
            Id = accountRecord.Id,
            Name = 'テスト（株）'
        );
        Map<Id, Account> oldAccountsById = new Map<Id, Account>{
            accountRecord.Id => accountRecord
        };

        // 実行
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountTriggerService.beforeUpdate(
                new List<Account>{ updatedAccount },
                oldAccountsById
            );
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            'Before update service should normalize changed Account names.'
        );
    }

    @IsTest
    static void beforeUpdateShouldSkipUnchangedAccountNames() {
        // 準備
        Account savedAccount = TestDataFactory.insertAccount('テスト取引先');
        Account accountRecord = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );
        Account oldAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );
        Map<Id, Account> oldAccountsById = new Map<Id, Account>{
            accountRecord.Id => oldAccount
        };

        // 実行
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountTriggerService.beforeUpdate(
                new List<Account>{ accountRecord },
                oldAccountsById
            );
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '㈱テスト',
            accountRecord.Name,
            'Unchanged Account names should not be normalized during update handling.'
        );
    }

    @IsTest
    static void beforeInsertShouldDoNothingWhenAccountsEmpty() {
        // 準備
        List<Account> accounts = new List<Account>();

        // 実行
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountTriggerService.beforeInsert(accounts);
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(0, accounts.size(), 'Empty input should remain empty.');
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
