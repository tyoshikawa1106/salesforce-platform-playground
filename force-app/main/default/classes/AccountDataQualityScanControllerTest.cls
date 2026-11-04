/**
 * 取引先データ品質スキャンのApex入口テスト
 */
@IsTest
private with sharing class AccountDataQualityScanControllerTest {
    private static final DataQualityScan__c EMPTY_SCAN = new DataQualityScan__c(
        Target_Object__c = 'Account', Processed_Count__c = 0, Missing_Phone_Count__c = 0,
        Missing_Industry_Count__c = 0, Missing_Address_Count__c = 0, Missing_Website_Count__c = 0,
        Missing_Account_Number_Count__c = 0
    );

    private static final String TEST_USER_MARKER = 'DQScanController';

    /**
     * USER_MODE処理に必要な権限をテストユーザーへ割り当て
     */
    @TestSetup
    static void setupPermission() {
        User scanUser = new User(Alias = 'dqscan', Email = 'data-quality-scan@example.invalid',
            EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'ja', LastName = TEST_USER_MARKER,
            LocaleSidKey = 'ja_JP', ProfileId = UserInfo.getProfileId(), TimeZoneSidKey = 'Asia/Tokyo',
            Username = 'data-quality-scan.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid');
        insert scanUser;
        insert new PermissionSetAssignment(AssigneeId = scanUser.Id, PermissionSetId = scanPermissionId());
    }

    /**
     * 履歴がない場合は直近スキャンを返さない
     */
    @IsTest
    static void shouldReturnNullWhenNoScanExists() {
        User testUser = getScanTestUser();
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
        User testUser = getScanTestUser();
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
     * 開始入口から既定区間を超える取引先を最後まで集計
     */
    @IsTest
    static void shouldCompleteScanBeyondDefaultChunkSize() {
        User testUser = getScanTestUser();
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 501; index++) {
            accounts.add(new Account(Name = '分割スキャン取引先' + index));
        }
        insert accounts;
        AccountDataQualityScanWrapper startResult;
        DataQualityScan__c savedScan;

        System.runAs(testUser) {
            Test.startTest();

            startResult = AccountDataQualityScanController.startScan();

            Test.stopTest();
            savedScan = [
                SELECT Status__c, Processed_Count__c, Missing_Phone_Count__c, Active_Key__c
                FROM DataQualityScan__c
                WHERE Id = :startResult.scanId
            ];
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_PENDING, startResult.status, '開始応答は待機状態を返す必要あり');
        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, savedScan.Status__c, '次区間へ連鎖して完了する必要あり');
        Assert.areEqual(501, savedScan.Processed_Count__c, '既定500件を超える最終レコードまで処理する必要あり');
        Assert.areEqual(501, savedScan.Missing_Phone_Count__c, '全区間の電話未設定件数を累積する必要あり');
        Assert.isNull(savedScan.Active_Key__c, '全区間の完了後に再実行を許可する必要あり');
    }

    /**
     * 実行中スキャンがある場合は新しい開始を拒否
     */
    @IsTest
    static void shouldRejectStartWhenActiveScanExists() {
        User testUser = getScanTestUser();

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
                Active_Key__c = (AccountDataQualityScanService.STATUS_RUNNING == AccountDataQualityScanService.STATUS_PENDING || AccountDataQualityScanService.STATUS_RUNNING == AccountDataQualityScanService.STATUS_RUNNING) ? AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY : null
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
        User testUser = getScanTestUser();
        DataQualityScan__c scanRecord;
        AccountDataQualityScanWrapper result;

        System.runAs(testUser) {
            scanRecord = EMPTY_SCAN.clone();
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

    /**
     * 参照権限不足では結果を取得せず保存と非同期登録も行わない
     */
    @IsTest
    static void shouldRejectReadAndStartWithoutReadAccess() {
        List<Profile> profiles = [SELECT Id FROM Profile WHERE PermissionsModifyAllData = false AND UserLicense.Name = 'Salesforce' LIMIT 1];
        Assert.isFalse(profiles.isEmpty(), '権限を持たないプロファイルで検証');
        User deniedUser = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'スキャン参照なし',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        deniedUser.ProfileId = profiles[0].Id;
        insert deniedUser;

        System.runAs(deniedUser) {
            Test.startTest();

            AccountDataQualityScanWrapper latest = AccountDataQualityScanController.getLatestScan();
            AccountDataQualityScanWrapper started = AccountDataQualityScanController.startScan();

            Assert.areEqual('取引先またはスキャン結果の参照権限がありません。管理者に権限を確認してください。', latest.accessErrorMessage, '権限不足を履歴なしと区別する必要あり');
            Assert.areEqual(latest.accessErrorMessage, started.accessErrorMessage, '開始時も同じ権限不足を返す必要あり');
            Assert.isNull(latest.scanId, '権限不足では結果を返さない必要あり');
            Assert.isNull(started.scanId, '権限不足ではスキャンを作成しない必要あり');
            Assert.areEqual(0, Limits.getQueries(), '権限不足ではスキャン検索を実行しない必要あり');
            Assert.areEqual(0, Limits.getDmlStatements(), '権限不足では保存を実行しない必要あり');
            Assert.areEqual(0, Limits.getQueueableJobs(), '権限不足では非同期登録しない必要あり');
            Test.stopTest();
        }
    }

    /**
     * スキャン実行に必要な権限セットの存在を確認
     * @return スキャン用の権限セットID
     */
    private static Id scanPermissionId() {
        List<PermissionSet> permissions = [SELECT Id FROM PermissionSet WHERE Name = 'LwcAccountDataQualityScan'];
        Assert.isFalse(permissions.isEmpty(), 'スキャンのテスト権限が存在');
        return permissions[0].Id;
    }

    /**
     * このテストで作成したスキャン実行ユーザーを取得
     * @return 保存済みのテストユーザー
     */
    private static User getScanTestUser() {
        List<User> users = [
            SELECT Id
            FROM User
            WHERE LastName = :TEST_USER_MARKER
        ];
        Assert.areEqual(1, users.size(), '同じテストクラスのユーザーを取得');
        return users[0];
    }
}