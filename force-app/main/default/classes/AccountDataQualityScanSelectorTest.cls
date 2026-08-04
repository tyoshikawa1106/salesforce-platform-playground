/**
 * 取引先Cursorとスキャン管理レコードのデータアクセステスト
 */
@IsTest
private with sharing class AccountDataQualityScanSelectorTest {
    private static final String TEST_USER_MARKER = 'DQScanSelector';

    /**
     * USER_MODE処理に必要な権限をテストユーザーへ割り当て
     */
    @TestSetup
    static void setupPermission() {
        TestDataFactory.createAccountDataQualityScanTestUser(TEST_USER_MARKER);
    }

    /**
     * 利用者が参照できる取引先をCursorで分割取得
     */
    @IsTest
    static void shouldCreateCursorAndFetchVisibleAccounts() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        TestDataFactory.createAccount('Cursor取引先1', TestDataFactory.SaveMode.INSERT_RECORD);
        TestDataFactory.createAccount('Cursor取引先2', TestDataFactory.SaveMode.INSERT_RECORD);
        Database.Cursor accountCursor;
        List<Account> accounts;

        System.runAs(testUser) {
            Test.startTest();

            AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();
            accountCursor = selector.createAccountCursor();
            accounts = selector.fetchAccounts(accountCursor, 0, 500);

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
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        List<Account> accounts;

        System.runAs(testUser) {
            Test.startTest();

            accounts = new AccountDataQualityScanSelector().fetchAccounts(null, -1, 0);

            Test.stopTest();
        }

        Assert.areEqual(0, accounts.size(), '不正な取得条件では空の取引先一覧を返す必要あり');
    }

    /**
     * 実行中と最新のスキャンを未加工の List で取得
     */
    @IsTest
    static void shouldSelectActiveAndLatestScans() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_PENDING,
            10,
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        List<DataQualityScan__c> activeScans;
        List<DataQualityScan__c> latestScans;

        System.runAs(testUser) {
            Test.startTest();

            AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();
            activeScans = selector.getActiveScans();
            latestScans = selector.getLatestScans();

            Test.stopTest();
        }

        Assert.areEqual(1, activeScans.size(), 'Account の実行中スキャンを1件取得する必要あり');
        Assert.areEqual(scanRecord.Id, activeScans[0].Id, 'Account の実行中スキャンを返す必要あり');
        Assert.areEqual(1, latestScans.size(), '最新スキャンを1件取得する必要あり');
        Assert.areEqual(scanRecord.Id, latestScans[0].Id, '作成日時が最新のスキャンを返す必要あり');
    }
}
