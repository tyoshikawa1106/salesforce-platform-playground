/**
 * 取引先データ品質判定と状態遷移テスト
 */
@IsTest
private with sharing class AccountDataQualityScanServiceTest {

    private static AccountDataQualityScanService service = new AccountDataQualityScanService();

    private static User testUser = new User(Id = UserInfo.getUserId());
    private static final DataQualityScan__c EMPTY_SCAN = new DataQualityScan__c(
        Target_Object__c = 'Account', Processed_Count__c = 0, Missing_Phone_Count__c = 0,
        Missing_Industry_Count__c = 0, Missing_Address_Count__c = 0, Missing_Website_Count__c = 0,
        Missing_Account_Number_Count__c = 0
    );

    /**
     * 不足項目を累積して最終区間で完了へ遷移
     */
    @IsTest
    static void shouldCountMissingValuesAndCompleteWhenLastChunkProcessed() {
        DataQualityScan__c scanRecord = EMPTY_SCAN.clone();
        scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
        scanRecord.Total_Count__c = 2;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = UserInfo.getUserId();
        scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
        Account completeAccount = createCompleteAccount('完全な取引先');
        Account missingAccount = new Account(Name = '不足する取引先');
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
        Assert.areEqual(AccountDataQualityScanService.STATUS_PENDING, scanRecord.Status__c, '集計元の状態を変更しない');
        Assert.areEqual(0, scanRecord.Processed_Count__c, '集計元の進捗を変更しない');
    }

    /**
     * 請求先住所の5項目のいずれかが空なら住所不足として集計
     */
    @IsTest
    static void shouldCountAddressMissingWhenAnyRequiredPartIsBlank() {
        DataQualityScan__c scanRecord = EMPTY_SCAN.clone();
        scanRecord.Status__c = AccountDataQualityScanService.STATUS_RUNNING;
        scanRecord.Total_Count__c = 1;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = UserInfo.getUserId();
        scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
        Account accountRecord = createCompleteAccount('郵便番号なし取引先');
        accountRecord.BillingPostalCode = null;
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.applyChunk(scanRecord, new List<Account>{ accountRecord }, 1);

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
        DataQualityScan__c scanRecord = EMPTY_SCAN.clone();
        scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
        scanRecord.Total_Count__c = 5;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = UserInfo.getUserId();
        scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.applyChunk(scanRecord, new List<Account>{ new Account(Name = '途中取引先') }, 1);

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
        DataQualityScan__c scanRecord = EMPTY_SCAN.clone();
        scanRecord.Status__c = AccountDataQualityScanService.STATUS_RUNNING;
        scanRecord.Total_Count__c = 1;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = UserInfo.getUserId();
        scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.markFailed(scanRecord, null);

            Test.stopTest();
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_FAILED, result.Status__c, '失敗状態へ遷移する必要あり');
        Assert.areEqual(AccountDataQualityScanService.SAFE_FAILURE_MESSAGE, result.Error_Message__c, '内部情報を含まない既定エラーを保存する必要あり');
        Assert.isNull(result.Active_Key__c, '失敗時は再実行できるよう重複防止キーを解放する必要あり');
        Assert.areEqual(AccountDataQualityScanService.STATUS_RUNNING, scanRecord.Status__c, '失敗判定で入力状態を変更しない');
    }

    /**
     * 終了済みスキャンの再集計を拒否
     */
    @IsTest
    static void shouldRejectChunkWhenScanAlreadyCompleted() {
        DataQualityScan__c scanRecord = EMPTY_SCAN.clone();
        scanRecord.Status__c = AccountDataQualityScanService.STATUS_COMPLETED;
        scanRecord.Total_Count__c = 1;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = UserInfo.getUserId();
        scanRecord.Active_Key__c = null;

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.applyChunk(scanRecord, new List<Account>(), 1);
                Assert.fail('終了済みスキャンは再集計を拒否する必要あり');
            } catch (AccountDataQualityScanService.ScanException e) {
                Assert.isTrue(e.getMessage().contains('終了済み'), '終了済みであることを示す例外にする必要あり');
            }
            Test.stopTest();
        }
    }

    /**
     * 空の検索結果を非 null のスキャン管理レコードへ変換
     */
    @IsTest
    static void shouldReturnEmptyScanWhenQueryResultIsEmpty() {
        DataQualityScan__c result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.getFirstScan(new List<DataQualityScan__c>());

            Test.stopTest();
        }

        Assert.isNotNull(result, '空結果でも非 null のスキャン管理レコードを返す必要あり');
        Assert.isNull(result.Id, '空結果のスキャン管理レコードは未保存である必要あり');
    }

    /**
     * 保存済みの実行中スキャンがない場合だけ開始を許可
     */
    @IsTest
    static void shouldAllowStartOnlyWithoutActiveScan() {
        Id savedScanId = Id.valueOf(
            DataQualityScan__c.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() +
            '000000000000'
        );
        DataQualityScan__c savedScan = new DataQualityScan__c(Id = savedScanId);
        Boolean canStartWithoutActiveScan;
        Boolean canStartWithActiveScan;

        System.runAs(testUser) {
            Test.startTest();

            canStartWithoutActiveScan = service.canStartScan(new DataQualityScan__c());
            canStartWithActiveScan = service.canStartScan(savedScan);

            Test.stopTest();
        }

        Assert.isTrue(canStartWithoutActiveScan, '保存済みの実行中スキャンがなければ開始を許可する必要あり');
        Assert.isFalse(canStartWithActiveScan, '保存済みの実行中スキャンがあれば開始を拒否する必要あり');
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

    /** 初期化・表示変換・完了判定を保存せず確認 */
    @IsTest
    static void createsAndPresentsScanState() {

        System.runAs(testUser) {
            Test.startTest();
            Assert.areEqual(
                Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible() && DataQualityScan__c.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible(),
                service.canReadScan(), '参照権限の判定を返す'
            );
            DataQualityScan__c scan = service.createPendingScan(2, testUser.Id);
            Assert.areEqual(0, service.createPendingScan(null, testUser.Id).Total_Count__c, '未指定総件数はゼロ');
            Assert.areEqual(AccountDataQualityScanService.STATUS_PENDING, scan.Status__c, '開始前の状態を設定');
            Assert.areEqual(testUser.Id, scan.Requested_By__c, '依頼者を保持');
            Assert.isNull(service.createViewModel(scan), '未保存のスキャンは表示しない');
            Assert.isFalse(service.isCompleted(null), 'スキャンなしは未完了');
            Assert.isFalse(service.isCompleted(scan), '待機中は未完了');
            scan.Id = Id.valueOf(DataQualityScan__c.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
            scan.Processed_Count__c = 1;
            AccountDataQualityScanWrapper halfway = service.createViewModel(scan);
            Assert.areEqual(50, halfway.progressPercent, '処理済み位置から進捗率を計算');
            Assert.areEqual(scan, service.getFirstScan(new List<DataQualityScan__c>{ scan }), '先頭スキャンを返す');
            scan.Status__c = AccountDataQualityScanService.STATUS_COMPLETED;
            Assert.isTrue(service.isCompleted(scan), '完了状態を判定');
            scan.Total_Count__c = 0;
            Assert.areEqual(100, service.createViewModel(scan).progressPercent, 'ゼロ件完了は100%');
            scan.Status__c = AccountDataQualityScanService.STATUS_PENDING;
            Assert.areEqual(0, service.createViewModel(scan).progressPercent, 'ゼロ件待機は0%');
            Test.stopTest();
        }
    }

    /** 管理レコードなしの更新は拒否し、失敗記録は空値を返す */
    @IsTest
    static void handlesMissingScanWithoutDml() {

        System.runAs(testUser) {
            Test.startTest();
            Assert.isNull(service.markFailed(null, '処理失敗').Id, '対象なしでは更新対象を作らない');
            try {
                service.applyChunk(null, new List<Account>(), 0);
                Assert.fail('対象なしの集計は拒否');
            } catch (AccountDataQualityScanService.ScanException e) {
                Assert.isTrue(e.getMessage().contains('ありません'), '管理レコード不足を通知');
            }
            Test.stopTest();
        }
    }
}
