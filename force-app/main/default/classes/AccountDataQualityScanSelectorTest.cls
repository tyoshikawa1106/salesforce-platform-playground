/**
 * 取引先Cursorとスキャン管理レコードのデータアクセステスト
 */
@IsTest
private with sharing class AccountDataQualityScanSelectorTest {
    private static final DataQualityScan__c EMPTY_SCAN = new DataQualityScan__c(
        Target_Object__c = 'Account', Processed_Count__c = 0, Missing_Phone_Count__c = 0,
        Missing_Industry_Count__c = 0, Missing_Address_Count__c = 0, Missing_Website_Count__c = 0,
        Missing_Account_Number_Count__c = 0
    );

    private static final String TEST_USER_MARKER = 'DQScanSelector';

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
     * 利用者が参照できる取引先をCursorで分割取得
     */
    @IsTest
    static void shouldCreateCursorAndFetchVisibleAccounts() {
        User testUser = getScanTestUser();
        insert new Account(Name = 'Cursor取引先1');
        insert new Account(Name = 'Cursor取引先2');
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
        User testUser = getScanTestUser();
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
        User testUser = getScanTestUser();
        DataQualityScan__c scanRecord;
        List<DataQualityScan__c> activeScans;
        List<DataQualityScan__c> latestScans;

        System.runAs(testUser) {
            scanRecord = EMPTY_SCAN.clone();
            scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
            scanRecord.Total_Count__c = 10;
            scanRecord.Started_At__c = System.now();
            scanRecord.Requested_By__c = UserInfo.getUserId();
            scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
            insert scanRecord;
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