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
     * スキャンの保存、更新、最新結果取得を利用者権限で実行
     */
    @IsTest
    static void shouldInsertUpdateAndSelectLatestScan() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_PENDING,
            10,
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        DataQualityScan__c activeScan;
        DataQualityScan__c latestScan;

        System.runAs(testUser) {
            Test.startTest();

            AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();
            selector.insertScan(scanRecord);
            activeScan = selector.getActiveScan();
            scanRecord.Processed_Count__c = 4;
            selector.updateScan(scanRecord);
            latestScan = selector.getLatestScan();

            Test.stopTest();
        }

        Assert.areEqual(scanRecord.Id, activeScan.Id, 'Accountの実行中スキャンを取得する必要あり');
        Assert.areEqual(4, latestScan.Processed_Count__c, '更新済みの最新進捗を取得する必要あり');
    }

    /**
     * 同じ対象の実行中スキャンを一意制約で拒否
     */
    @IsTest
    static void shouldRejectDuplicateActiveScanKey() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        DataQualityScan__c firstScan;
        DataQualityScan__c duplicateScan;

        System.runAs(testUser) {
            firstScan = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_PENDING,
                1,
                TestDataFactory.SaveMode.INSERT_RECORD
            );
            duplicateScan = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_RUNNING,
                1,
                TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            Test.startTest();
            try {
                new AccountDataQualityScanSelector().insertScan(duplicateScan);
                Assert.fail('同じ対象の実行中スキャンは一意制約で拒否する必要あり');
            } catch (DmlException e) {
                Assert.areEqual('DUPLICATE_VALUE', e.getDmlStatusCode(0), '重複キーによるDMLエラーにする必要あり');
            }
            Test.stopTest();
        }

        Assert.isNotNull(firstScan.Id, '先行する実行中スキャンは保存済みである必要あり');
    }
}
