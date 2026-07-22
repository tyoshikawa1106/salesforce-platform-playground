/**
 * 取引先データ品質判定と状態遷移テスト
 */
@IsTest
private with sharing class AccountDataQualityScanServiceTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 不足項目を累積して最終区間で完了へ遷移
     */
    @IsTest
    static void shouldCountMissingValuesAndCompleteWhenLastChunkProcessed() {
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_PENDING,
            2,
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        Account completeAccount = createCompleteAccount('完全な取引先');
        Account missingAccount = new Account(Name = '不足する取引先');
        AccountDataQualityScanService service = new AccountDataQualityScanService();
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.applyChunk(scanRecord, new List<Account>{ completeAccount, missingAccount }, 2);

            Test.stopTest();
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, result.Status__c, '最終位置まで処理したスキャンは完了にする必要あり');
        Assert.areEqual(2, result.Processed_Count__c, 'Cursor上の処理済み位置を保存する必要あり');
        Assert.areEqual(1, result.Missing_Phone_Count__c, '電話番号不足を1件として集計する必要あり');
        Assert.areEqual(1, result.Missing_Industry_Count__c, '業種不足を1件として集計する必要あり');
        Assert.areEqual(1, result.Missing_Address_Count__c, '請求先住所不足を1件として集計する必要あり');
        Assert.areEqual(1, result.Missing_Website_Count__c, 'Webサイト不足を1件として集計する必要あり');
        Assert.areEqual(1, result.Missing_Account_Number_Count__c, '取引先番号不足を1件として集計する必要あり');
        Assert.isNull(result.Active_Key__c, '完了時は重複防止キーを解放する必要あり');
        Assert.isNotNull(result.Completed_At__c, '完了時は終了日時を保存する必要あり');
    }

    /**
     * 請求先住所の5項目のいずれかが空なら住所不足として集計
     */
    @IsTest
    static void shouldCountAddressMissingWhenAnyRequiredPartIsBlank() {
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_RUNNING,
            1,
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        Account accountRecord = createCompleteAccount('郵便番号なし取引先');
        accountRecord.BillingPostalCode = null;
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountDataQualityScanService().applyChunk(scanRecord, new List<Account>{ accountRecord }, 1);

            Test.stopTest();
        }

        Assert.areEqual(1, result.Missing_Address_Count__c, '請求先住所の必須構成項目が空なら不足にする必要あり');
        Assert.areEqual(0, result.Missing_Phone_Count__c, '入力済みの電話番号は不足へ加算しない必要あり');
    }

    /**
     * 途中区間では累積値を保持して処理中を継続
     */
    @IsTest
    static void shouldRemainRunningWhenCursorHasRemainingPositions() {
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_PENDING,
            5,
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountDataQualityScanService().applyChunk(scanRecord, new List<Account>{ new Account(Name = '途中取引先') }, 1);

            Test.stopTest();
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_RUNNING, result.Status__c, '残りがあるスキャンは処理中にする必要あり');
        Assert.areEqual(1, result.Processed_Count__c, '次のCursor位置を処理済み件数へ保存する必要あり');
        Assert.areEqual(AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY, result.Active_Key__c, '処理中は重複防止キーを維持する必要あり');
    }

    /**
     * 失敗時は再実行できる状態へ変更
     */
    @IsTest
    static void shouldMarkFailedAndReleaseActiveKey() {
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_RUNNING,
            1,
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountDataQualityScanService().markFailed(scanRecord, null);

            Test.stopTest();
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_FAILED, result.Status__c, '失敗状態へ遷移する必要あり');
        Assert.areEqual(AccountDataQualityScanService.SAFE_FAILURE_MESSAGE, result.Error_Message__c, '内部情報を含まない既定エラーを保存する必要あり');
        Assert.isNull(result.Active_Key__c, '失敗時は再実行できるよう重複防止キーを解放する必要あり');
    }

    /**
     * 終了済みスキャンの再集計を拒否
     */
    @IsTest
    static void shouldRejectChunkWhenScanAlreadyCompleted() {
        DataQualityScan__c scanRecord = TestDataFactory.createDataQualityScan(
            AccountDataQualityScanService.STATUS_COMPLETED,
            1,
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                new AccountDataQualityScanService().applyChunk(scanRecord, new List<Account>(), 1);
                Assert.fail('終了済みスキャンは再集計を拒否する必要あり');
            } catch (AccountDataQualityScanService.ScanException e) {
                Assert.isTrue(e.getMessage().contains('終了済み'), '終了済みであることを示す例外にする必要あり');
            }
            Test.stopTest();
        }
    }

    private static Account createCompleteAccount(String accountName) {
        Account accountRecord = new Account();
        accountRecord.Name = accountName;
        accountRecord.Phone = '03-0000-0000';
        accountRecord.Industry = 'Technology';
        accountRecord.BillingStreet = '丸の内1-1-1';
        accountRecord.BillingCity = '千代田区';
        accountRecord.BillingState = '東京都';
        accountRecord.BillingPostalCode = '100-0005';
        accountRecord.BillingCountry = '日本';
        accountRecord.Website = 'https://example.com';
        accountRecord.AccountNumber = 'ACC-001';
        return accountRecord;
    }
}
