/**
 * 取引先データ品質スキャンのApex入口テスト
 */
@IsTest
private with sharing class AccountDataQualityScanControllerTest {
    private static final String TEST_USER_MARKER = 'DQScanController';

    /**
     * USER_MODE処理に必要な権限をテストユーザーへ割り当て
     */
    @TestSetup
    static void setupPermission() {
        TestDataFactory.createAccountDataQualityScanTestUser(TEST_USER_MARKER);
    }

    /**
     * 履歴がない場合は直近スキャンを返さない
     */
    @IsTest
    static void shouldReturnNullWhenNoScanExists() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        AccountDataQualityScanWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = AccountDataQualityScanController.getLatestScan();

            Test.stopTest();
        }

        Assert.isNull(result, 'スキャン履歴がない場合はnullを返す必要あり');
    }

    /**
     * 取引先Cursorと管理レコードを作成してスキャンを開始
     */
    @IsTest
    static void shouldStartAndCompleteScan() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        TestDataFactory.createAccount('Controllerスキャン取引先', TestDataFactory.SaveMode.INSERT_RECORD);
        AccountDataQualityScanWrapper startResult;
        DataQualityScan__c savedScan;

        System.runAs(testUser) {
            Test.startTest();

            startResult = AccountDataQualityScanController.startScan();

            Test.stopTest();
            savedScan = [
                SELECT Status__c, Total_Count__c, Processed_Count__c, Requested_By__c
                FROM DataQualityScan__c
                WHERE Id = :startResult.scanId
            ];
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_PENDING, startResult.status, '画面には非同期登録直後の待機状態を返す必要あり');
        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, savedScan.Status__c, '非同期処理後は完了状態を保存する必要あり');
        Assert.areEqual(1, savedScan.Total_Count__c, 'Cursor作成時の対象総件数を保存する必要あり');
        Assert.areEqual(testUser.Id, savedScan.Requested_By__c, '開始利用者を保存する必要あり');
    }

    /**
     * 実行中スキャンがある場合は新しい開始を拒否
     */
    @IsTest
    static void shouldRejectStartWhenActiveScanExists() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);

        System.runAs(testUser) {
            TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_RUNNING,
                10,
                TestDataFactory.SaveMode.INSERT_RECORD
            );
            Test.startTest();
            try {
                AccountDataQualityScanController.startScan();
                Assert.fail('実行中スキャンがある場合は開始を拒否する必要あり');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('実行中'), '利用者へ実行中であることを案内する必要あり');
            }
            Test.stopTest();
        }
    }

    /**
     * 保存済みの直近スキャンを表示値へ変換
     */
    @IsTest
    static void shouldReturnLatestScanViewModel() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        DataQualityScan__c scanRecord;
        AccountDataQualityScanWrapper result;

        System.runAs(testUser) {
            scanRecord = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_COMPLETED,
                4,
                TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            scanRecord.Processed_Count__c = 4;
            scanRecord.Completed_At__c = System.now();
            insert scanRecord;
            Test.startTest();

            result = AccountDataQualityScanController.getLatestScan();

            Test.stopTest();
        }

        Assert.areEqual(scanRecord.Id, result.scanId, '直近スキャンのIDを返す必要あり');
        Assert.areEqual(100, result.progressPercent, '完了済みスキャンは進捗100パーセントにする必要あり');
    }

    /**
     * 状態取得失敗を内部情報を含まないAura例外へ変換
     */
    @IsTest
    static void shouldReturnSafeErrorWhenLatestScanFails() {
        User testUser = TestDataFactory.getAccountDataQualityScanTestUser(TEST_USER_MARKER);
        AccountDataQualityScanController.selector = new FailingSelector();

        System.runAs(testUser) {
            Test.startTest();
            try {
                AccountDataQualityScanController.getLatestScan();
                Assert.fail('状態取得失敗はAuraHandledExceptionへ変換する必要あり');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('スキャン状態を取得できませんでした'), '利用者向けの安全な文言を返す必要あり');
            }
            Test.stopTest();
        }
    }

    private class FailingSelector extends AccountDataQualityScanSelector {
        public override DataQualityScan__c getLatestScan() {
            throw new AccountDataQualityScanService.ScanException('テスト用取得失敗');
        }
    }
}
