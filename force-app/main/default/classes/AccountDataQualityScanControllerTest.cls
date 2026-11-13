/**
 * 取引先データ品質スキャンのApex入口テスト
 */
@IsTest
private with sharing class AccountDataQualityScanControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 履歴がない場合は直近スキャンを返さない
     */
    @IsTest
    static void shouldReturnNullWhenNoScanExists() {
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
        insert new Account(Name = 'Controllerスキャン取引先');
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

        System.runAs(testUser) {
            insert new DataQualityScan__c(
                Status__c = AccountDataQualityScanService.STATUS_RUNNING,
                Target_Object__c = 'Account',
                Total_Count__c = 10,
                Processed_Count__c = 0,
                Missing_Phone_Count__c = 0,
                Missing_Industry_Count__c = 0,
                Missing_Address_Count__c = 0,
                Missing_Website_Count__c = 0,
                Missing_Account_Number_Count__c = 0,
                Started_At__c = System.now(),
                Requested_By__c = UserInfo.getUserId(),
                Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY
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
        DataQualityScan__c scanRecord;
        AccountDataQualityScanWrapper result;

        System.runAs(testUser) {
            scanRecord = new DataQualityScan__c(
                Target_Object__c = 'Account', Processed_Count__c = 0, Missing_Phone_Count__c = 0,
                Missing_Industry_Count__c = 0, Missing_Address_Count__c = 0, Missing_Website_Count__c = 0,
                Missing_Account_Number_Count__c = 0
            );
            scanRecord.Status__c = AccountDataQualityScanService.STATUS_COMPLETED;
            scanRecord.Total_Count__c = 4;
            scanRecord.Started_At__c = System.now();
            scanRecord.Requested_By__c = UserInfo.getUserId();
            scanRecord.Active_Key__c = null;
            scanRecord.Processed_Count__c = 4;
            scanRecord.Completed_At__c = System.now();
            insert scanRecord;
            Test.startTest();

            result = AccountDataQualityScanController.getLatestScan();

            Test.stopTest();
        }

        Assert.areEqual('', result.accessErrorMessage, '通常応答には権限不足の案内を含めない必要あり');
        Assert.areEqual(scanRecord.Id, result.scanId, '直近スキャンのIDを返す必要あり');
        Assert.areEqual(100, result.progressPercent, '完了済みスキャンは進捗100パーセントにする必要あり');
    }

    /** 参照権限不足なら履歴取得前に終了 */
    @IsTest
    static void rejectsGetLatestScanWithoutReadAccess() {
        System.runAs(testUser) {
            Test.startTest();
            AccountDataQualityScanWrapper result = AccountDataQualityScanController.getLatestScanForAccess(false);
            Assert.areEqual('取引先またはスキャン結果の参照権限がありません。管理者に権限を確認してください。', result.accessErrorMessage, '参照権限の不足を通知');
            Assert.areEqual(0, Limits.getQueries(), '拒否後に履歴を取得しない');
            Assert.areEqual(0, Limits.getDmlStatements(), '拒否後に保存しない');
            Assert.areEqual(0, Limits.getQueueableJobs(), '拒否後にスキャンを登録しない');
            Test.stopTest();
        }
    }

    /** 参照権限不足なら開始前に終了 */
    @IsTest
    static void rejectsStartScanWithoutReadAccess() {
        System.runAs(testUser) {
            Test.startTest();
            AccountDataQualityScanWrapper result = AccountDataQualityScanController.startScanForAccess(false);
            Assert.areEqual('取引先またはスキャン結果の参照権限がありません。管理者に権限を確認してください。', result.accessErrorMessage, '参照権限の不足を通知');
            Assert.areEqual(0, Limits.getQueries(), '拒否後に履歴を取得しない');
            Assert.areEqual(0, Limits.getDmlStatements(), '拒否後に保存しない');
            Assert.areEqual(0, Limits.getQueueableJobs(), '拒否後にスキャンを登録しない');
            Test.stopTest();
        }
    }

}
