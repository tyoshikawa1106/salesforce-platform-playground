/**
 * 取引先Cursorとスキャン管理レコードのデータアクセステスト
 */
@IsTest
private with sharing class AccountDataQualityScanSelectorTest {

    private static AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 利用者が参照できる取引先をCursorで分割取得
     */
    @IsTest
    static void shouldCreateCursorAndFetchVisibleAccounts() {
        insert new Account(Name = 'Cursor取引先1');
        insert new Account(Name = 'Cursor取引先2');
        Database.Cursor accountCursor;
        List<Account> accounts;

        System.runAs(testUser) {
            Test.startTest();

            accountCursor = selector.createAccountCursor();
            accounts = selector.fetchAccounts(accountCursor, 0, 500);
            Assert.isTrue(selector.fetchAccounts(accountCursor, 2, 1).isEmpty(), '末尾以降は取得しない');

            Test.stopTest();
        }

        Assert.areEqual(2, accountCursor.getNumRecords(), 'Cursorは参照可能な取引先2件を固定する必要あり');
        Assert.areEqual(2, accounts.size(), '残件数を超える取得指定では全取引先を返す必要あり');
    }

    /**
     * 不正なCursor取得条件は空結果へ変換
     */
    @IsTest
    static void shouldReturnEmptyAccountsWhenFetchInputInvalid() {
        List<Account> accounts;

        System.runAs(testUser) {
            Test.startTest();

            accounts = selector.fetchAccounts(null, -1, 0);

            Test.stopTest();
        }

        Assert.areEqual(0, accounts.size(), '不正な取得条件では空の取引先一覧を返す必要あり');
    }

    /**
     * 実行中と最新のスキャンを未加工の List で取得
     */
    @IsTest
    static void shouldSelectActiveAndLatestScans() {
        DataQualityScan__c scanRecord;
        List<DataQualityScan__c> activeScans;
        List<DataQualityScan__c> latestScans;

        System.runAs(testUser) {
            scanRecord = new DataQualityScan__c(
                Target_Object__c = 'Account', Processed_Count__c = 0, Missing_Phone_Count__c = 0,
                Missing_Industry_Count__c = 0, Missing_Address_Count__c = 0, Missing_Website_Count__c = 0,
                Missing_Account_Number_Count__c = 0
            );
            scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
            scanRecord.Total_Count__c = 10;
            scanRecord.Started_At__c = System.now();
            scanRecord.Requested_By__c = UserInfo.getUserId();
            scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
            insert scanRecord;
            Test.startTest();

            activeScans = selector.getActiveScans();
            latestScans = selector.getLatestScans();
            List<DataQualityScan__c> byId = selector.getScansById(scanRecord.Id);
            Integer queriesBeforeEmptyId = Limits.getQueries();
            Assert.isTrue(selector.getScansById(null).isEmpty(), '未指定IDは空結果');
            Assert.areEqual(queriesBeforeEmptyId, Limits.getQueries(), '未指定IDは問い合わせない');
            Assert.areEqual(scanRecord.Id, byId[0].Id, '指定したスキャンだけを取得');
            Assert.areEqual(1, byId.size(), '指定IDの一件だけを返す');

            Test.stopTest();
        }

        Assert.areEqual(1, activeScans.size(), 'Account の実行中スキャンを1件取得する必要あり');
        Assert.areEqual(scanRecord.Id, activeScans[0].Id, 'Account の実行中スキャンを返す必要あり');
        Assert.areEqual(1, latestScans.size(), '最新スキャンを1件取得する必要あり');
        Assert.areEqual(scanRecord.Id, latestScans[0].Id, '作成日時が最新のスキャンを返す必要あり');
    }

}
