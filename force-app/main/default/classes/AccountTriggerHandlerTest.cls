/**
 * 取引先トリガーによる名称補正テスト
 */
@IsTest
private with sharing class AccountTriggerHandlerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 新規取引先の法人格略称を正式名称へ補正
     */
    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenAccountsInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            new Account(Name = '㈱テスト'),
            new Account(Name = '㈲テスト')
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
        Assert.areEqual('株式会社テスト', accountsById.get(accounts[0].Id).Name, '挿入時に株式会社の略称を補正');
        Assert.areEqual('有限会社テスト', accountsById.get(accounts[1].Id).Name, '挿入した複数レコードへ補正を適用');
    }

    /**
     * 名称変更時の法人格略称を正式名称へ補正
     */
    @IsTest
    static void shouldNormalizeCompanyAbbreviationsWhenNameUpdated() {
        // 準備
        Account accountRecord = new Account(Name = 'テスト取引先');
        insert accountRecord;
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