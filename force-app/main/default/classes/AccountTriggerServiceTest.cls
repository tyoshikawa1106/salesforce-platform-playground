/**
 * 取引先トリガーサービスの振る舞いをテストします。
 */
@IsTest
private with sharing class AccountTriggerServiceTest {
    @IsTest
    static void beforeInsertShouldNormalizeAccountNames() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト')
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

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
