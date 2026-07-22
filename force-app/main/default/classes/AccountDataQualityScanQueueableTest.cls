/**
 * Cursor連鎖による取引先データ品質スキャンテスト
 */
@IsTest
private with sharing class AccountDataQualityScanQueueableTest {
    private static final String TEST_USER_MARKER = 'DQScanQueueable';

    /**
     * USER_MODE処理に必要な権限をテストユーザーへ割り当て
     */
    @TestSetup
    static void setupPermission() {
        TestDataFactory.createAccountDataQualityScanTestUser(TEST_USER_MARKER);
    }

    /**
     * 1区間で全取引先を集計して完了
     */
    @IsTest
    static void shouldCompleteScanWhenAllAccountsFitInChunk() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        TestDataFactory.createAccount('不足項目のある取引先', TestDataFactory.SaveMode.INSERT_RECORD);
        DataQualityScan__c scanRecord;
        Database.Cursor accountCursor;
        DataQualityScan__c result;

        System.runAs(testUser) {
            scanRecord = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_PENDING,
                1,
                TestDataFactory.SaveMode.INSERT_RECORD
            );
            accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            Test.startTest();

            System.enqueueJob(new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id));

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, result.Status__c, '1区間で全件処理したスキャンは完了する必要あり');
        Assert.areEqual(1, result.Processed_Count__c, '取引先1件を処理済みにする必要あり');
        Assert.areEqual(1, result.Missing_Phone_Count__c, '電話番号がない取引先を集計する必要あり');
        Assert.isNull(result.Active_Key__c, '完了したスキャンは再実行できる必要あり');
    }

    /**
     * 対象0件でも完了状態を記録
     */
    @IsTest
    static void shouldCompleteScanWhenCursorIsEmpty() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        DataQualityScan__c scanRecord;
        Database.Cursor accountCursor;
        DataQualityScan__c result;

        System.runAs(testUser) {
            scanRecord = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_PENDING,
                0,
                TestDataFactory.SaveMode.INSERT_RECORD
            );
            accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            Test.startTest();

            System.enqueueJob(new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id));

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, result.Status__c, '対象0件でも完了にする必要あり');
        Assert.areEqual(0, result.Processed_Count__c, '対象0件では処理済み件数をゼロにする必要あり');
    }

    /**
     * 残りがある場合は次位置を保存して処理中を維持
     */
    @IsTest
    static void shouldRemainRunningAndChainWhenMoreAccountsExist() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        TestDataFactory.createAccount('連鎖取引先1', TestDataFactory.SaveMode.INSERT_RECORD);
        TestDataFactory.createAccount('連鎖取引先2', TestDataFactory.SaveMode.INSERT_RECORD);
        DataQualityScan__c scanRecord;
        Database.Cursor accountCursor;
        DataQualityScan__c result;

        System.runAs(testUser) {
            scanRecord = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_PENDING,
                2,
                TestDataFactory.SaveMode.INSERT_RECORD
            );
            accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            Test.startTest();

            AccountDataQualityScanQueueable job = new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id);
            job.setFetchSizeForTest(1);
            job.stopBeforeChainingForTest();
            System.enqueueJob(job);

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_RUNNING, result.Status__c, '最初の区間後は処理中を維持する必要あり');
        Assert.areEqual(1, result.Processed_Count__c, '次のQueueableへ渡す位置を保存する必要あり');
        Assert.areEqual(AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY, result.Active_Key__c, '連鎖中は重複防止キーを維持する必要あり');
    }

    private static DataQualityScan__c getScan(Id scanId) {
        return [
            SELECT Status__c, Active_Key__c, Processed_Count__c, Missing_Phone_Count__c
            FROM DataQualityScan__c
            WHERE Id = :scanId
        ];
    }
}
