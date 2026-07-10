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

            // 挿入時トリガーで法人格略称を正式名称へ補正
            insert accounts;

            Test.stopTest();
        }

        // 検証
        Map<Id, Account> accountsById = getAccountsById(accounts);
        Assert.areEqual(
            '株式会社テスト',
            accountsById.get(accounts[0].Id).Name,
            '㈱ は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '株式会社テスト',
            accountsById.get(accounts[1].Id).Name,
            '（株）は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '株式会社テスト',
            accountsById.get(accounts[2].Id).Name,
            '(株) は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '有限会社テスト',
            accountsById.get(accounts[3].Id).Name,
            '㈲ は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '有限会社テスト',
            accountsById.get(accounts[4].Id).Name,
            '（有）は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '有限会社テスト',
            accountsById.get(accounts[5].Id).Name,
            '(有) は正式名称へ補正する必要あり'
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

            // 更新時トリガーで変更後の法人格略称を補正
            update accountRecord;

            Test.stopTest();
        }

        // 検証
        Account updatedAccount = getAccount(accountRecord);
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            '更新後の取引先名は正式名称へ補正する必要あり'
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

            // 法人格略称の位置を保ったまま挿入時補正を適用
            insert accounts;

            Test.stopTest();
        }

        // 検証
        Map<Id, Account> accountsById = getAccountsById(accounts);
        Assert.areEqual(
            'テスト株式会社',
            accountsById.get(accounts[0].Id).Name,
            '株式会社の法人格位置は維持する必要あり'
        );
        Assert.areEqual(
            'テスト有限会社',
            accountsById.get(accounts[1].Id).Name,
            '有限会社の法人格位置は維持する必要あり'
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

            // 一つの名称に含まれる複数の略称をまとめて補正
            insert accountRecord;

            Test.stopTest();
        }

        // 検証
        Account insertedAccount = getAccount(accountRecord);
        Assert.areEqual(
            '株式会社テスト有限会社支店',
            insertedAccount.Name,
            '取引先名に含まれる法人格略称はすべて補正する必要あり'
        );
    }

    @IsTest
    static void shouldKeepFormalCompanyNamesWhenAlreadyNormalized() {
        // 準備
        Account accountRecord = TestDataFactory.createAccount('株式会社テスト');

        // 実行
        System.runAs(testUser) {
            Test.startTest();

            // 既に正式名称の取引先名を変更対象から除外
            insert accountRecord;

            Test.stopTest();
        }

        // 検証
        Account insertedAccount = getAccount(accountRecord);
        Assert.areEqual(
            '株式会社テスト',
            insertedAccount.Name,
            '正式名称の取引先名は変更しない必要あり'
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

            // 不完全な略称を補正対象にしない挿入処理を検証
            insert accounts;

            Test.stopTest();
        }

        // 検証
        Map<Id, Account> accountsById = getAccountsById(accounts);
        Assert.areEqual(
            '株）テスト',
            accountsById.get(accounts[0].Id).Name,
            '不完全な株式会社略称は変更しない必要あり'
        );
        Assert.areEqual(
            '（株テスト',
            accountsById.get(accounts[1].Id).Name,
            '不完全な株式会社略称は変更しない必要あり'
        );
        Assert.areEqual(
            '有)テスト',
            accountsById.get(accounts[2].Id).Name,
            '不完全な有限会社略称は変更しない必要あり'
        );
        Assert.areEqual(
            '(有テスト',
            accountsById.get(accounts[3].Id).Name,
            '不完全な有限会社略称は変更しない必要あり'
        );
    }

    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenBulkInserted() {
        // 準備
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 251; index++) {
            Account accountRecord = TestDataFactory.createAccount('㈱テスト ' + index);
            accounts.add(accountRecord);
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
            '一括取引先はすべて作成される必要あり'
        );
        for (Account accountRecord : insertedAccounts) {
            Assert.isTrue(
                accountRecord.Name.startsWith('株式会社テスト '),
                '一括取引先名は正式名称へ補正する必要あり'
            );
        }
    }

    private static Account getAccount(Account accountRecord) {
        return getAccountsById(new List<Account>{ accountRecord })
            .get(accountRecord.Id);
    }

    private static Map<Id, Account> getAccountsById(List<Account> accounts) {
        List<Account> insertedAccounts = getAccounts(accounts);
        return new Map<Id, Account>(insertedAccounts);
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
