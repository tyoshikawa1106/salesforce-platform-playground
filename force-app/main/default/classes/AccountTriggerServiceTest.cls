/**
 * 取引先トリガーサービスの振る舞いテスト
 */
@IsTest
private with sharing class AccountTriggerServiceTest {
    private static User testUser = TestDataFactory.currentUser();

    private static AccountTriggerService service = new AccountTriggerService();

    @IsTest
    static void shouldNormalizeAccountNamesWhenInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト'),
            TestDataFactory.createAccount('テスト(有)支店')
        };

        // 実行
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeAccountNamesForInsert(accounts);
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            accounts[0].Name,
            'Insert service should normalize Account names.'
        );
        Assert.areEqual(
            'テスト有限会社支店',
            accounts[1].Name,
            'Insert service should normalize limited company names.'
        );
    }

    @IsTest
    static void shouldNormalizeChangedAccountNamesWhenUpdated() {
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
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeChangedAccountNamesForUpdate(
                new List<Account>{ updatedAccount },
                oldAccountsById
            );
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            'Update service should normalize changed Account names.'
        );
    }

    @IsTest
    static void shouldSkipUnchangedAccountNamesWhenUpdated() {
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
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeChangedAccountNamesForUpdate(
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
    static void shouldDoNothingWhenInsertedAccountsEmpty() {
        // 準備
        List<Account> accounts = new List<Account>();

        // 実行
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeAccountNamesForInsert(accounts);
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(0, accounts.size(), 'Empty input should remain empty.');
    }

    @IsTest
    static void shouldSkipNullAndBlankNamesWhenInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            null,
            TestDataFactory.createAccount(' '),
            TestDataFactory.createAccount('㈱テスト')
        };

        // 実行
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeAccountNamesForInsert(accounts);
            Test.stopTest();
        }

        // 検証
        Assert.isNull(accounts[0], 'Null list entries should stay null.');
        Assert.areEqual(
            ' ',
            accounts[1].Name,
            'Blank Account names should not be normalized.'
        );
        Assert.areEqual(
            '株式会社テスト',
            accounts[2].Name,
            'Nonblank Account names should still be normalized.'
        );
    }

    @IsTest
    static void shouldNormalizeWhenUpdatedOldAccountIsMissing() {
        // 準備
        Account savedAccount = TestDataFactory.insertAccount('テスト取引先');
        Account updatedAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );

        // 実行
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeChangedAccountNamesForUpdate(
                new List<Account>{ updatedAccount },
                new Map<Id, Account>()
            );
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            updatedAccount.Name,
            'Missing old Account entries should be treated as changed.'
        );
    }

    @IsTest
    static void shouldNormalizeWhenUpdatedOldAccountIsNull() {
        // 準備
        Account savedAccount = TestDataFactory.insertAccount('テスト取引先');
        Account updatedAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈲テスト'
        );

        // 実行
        System.runAs(testUser) {
            Test.startTest();
            service.normalizeChangedAccountNamesForUpdate(
                new List<Account>{ updatedAccount },
                new Map<Id, Account>{ savedAccount.Id => null }
            );
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '有限会社テスト',
            updatedAccount.Name,
            'Null old Account entries should be treated as changed.'
        );
    }
}
