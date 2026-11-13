/**
 * Cursor連鎖による取引先データ品質スキャンテスト
 */
@IsTest
private with sharing class AccountDataQualityScanQueueableTest {
    private static final DataQualityScan__c EMPTY_SCAN = new DataQualityScan__c(
        Target_Object__c = 'Account', Processed_Count__c = 0, Missing_Phone_Count__c = 0,
        Missing_Industry_Count__c = 0, Missing_Address_Count__c = 0, Missing_Website_Count__c = 0,
        Missing_Account_Number_Count__c = 0
    );

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 1区間で全取引先を集計して完了
     */
    @IsTest
    static void shouldCompleteScanWhenAllAccountsFitInChunk() {
        insert new Account(Name = '不足項目のある取引先');
        DataQualityScan__c scanRecord;
        Database.Cursor accountCursor;
        DataQualityScan__c result;

        System.runAs(testUser) {
            scanRecord = EMPTY_SCAN.clone();
            scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
            scanRecord.Total_Count__c = 1;
            scanRecord.Started_At__c = System.now();
            scanRecord.Requested_By__c = UserInfo.getUserId();
            scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
            insert scanRecord;
            accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            Test.startTest();

            new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id).enqueueInitialJob();

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
        DataQualityScan__c scanRecord;
        Database.Cursor accountCursor;
        DataQualityScan__c result;

        System.runAs(testUser) {
            scanRecord = EMPTY_SCAN.clone();
            scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
            scanRecord.Total_Count__c = 0;
            scanRecord.Started_At__c = System.now();
            scanRecord.Requested_By__c = UserInfo.getUserId();
            scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
            insert scanRecord;
            accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            Test.startTest();

            new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id).enqueueInitialJob();

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, result.Status__c, '対象0件でも完了にする必要あり');
        Assert.areEqual(0, result.Processed_Count__c, '対象0件では処理済み件数をゼロにする必要あり');
    }

    /**
     * 端数を含む複数区間を実際に連鎖して全件を重複なく集計
     */
    @IsTest
    static void shouldCompleteScanAcrossPartialFinalChunk() {
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 5; index++) {
            Account accountRecord = new Account(Name = '連鎖取引先' + index);
            accountRecord.Phone = index < 2 ? '03-0000-0000' : null;
            accountRecord.Website = index < 4 ? 'https://example.com' : null;
            accounts.add(accountRecord);
        }
        insert accounts;
        DataQualityScan__c result;

        System.runAs(testUser) {
            DataQualityScan__c scanRecord = createPendingScan(accounts.size());
            insert scanRecord;
            Database.Cursor accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            AccountDataQualityScanQueueable job = new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id);
            job.setFetchSizeForTest(2);
            Test.startTest();

            job.enqueueInitialJob();

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, result.Status__c, '端数区間まで実行して完了する必要あり');
        Assert.areEqual(5, result.Processed_Count__c, '連鎖した全区間の取引先を処理する必要あり');
        Assert.areEqual(3, result.Missing_Phone_Count__c, '電話未設定の3件を重複なく集計する必要あり');
        Assert.areEqual(1, result.Missing_Website_Count__c, 'Webサイト未設定の1件を重複なく集計する必要あり');
        Assert.isNull(result.Active_Key__c, '最終区間の完了後に重複防止キーを解放する必要あり');
        Assert.isNotNull(result.Completed_At__c, '最終区間の完了日時を保存する必要あり');
    }

    /**
     * Developer Editionの既定5段を超える連鎖でも全区間を完了
     */
    @IsTest
    static void shouldCompleteScanBeyondFiveChainedJobs() {
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 6; index++) {
            accounts.add(new Account(Name = '6段連鎖取引先' + index));
        }
        insert accounts;
        DataQualityScan__c result;

        System.runAs(testUser) {
            DataQualityScan__c scanRecord = createPendingScan(accounts.size());
            insert scanRecord;
            Database.Cursor accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            AccountDataQualityScanQueueable job = new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id);
            job.setFetchSizeForTest(1);
            Test.startTest();

            job.enqueueInitialJob();

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_COMPLETED, result.Status__c, '既定の5段を超えても全区間を完了する必要あり');
        Assert.areEqual(6, result.Processed_Count__c, '6段目までの取引先を処理する必要あり');
        Assert.areEqual(6, result.Missing_Phone_Count__c, '6段分の不足項目を累積する必要あり');
        Assert.isNull(result.Active_Key__c, '6段目の完了後に再実行を許可する必要あり');
    }

    /**
     * 非同期失敗を安全な文言で記録し再実行を許可
     */
    @IsTest
    static void shouldRecordFailureAndReleaseActiveKey() {
        DataQualityScan__c result;

        System.runAs(testUser) {
            DataQualityScan__c scanRecord = EMPTY_SCAN.clone();
            scanRecord.Status__c = AccountDataQualityScanService.STATUS_RUNNING;
            scanRecord.Total_Count__c = 10;
            scanRecord.Started_At__c = System.now();
            scanRecord.Requested_By__c = UserInfo.getUserId();
            scanRecord.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
            insert scanRecord;
            AccountDataQualityScanQueueable job = new AccountDataQualityScanQueueable(null, 0, scanRecord.Id);
            Test.startTest();

            job.execute(new FailedFinalizerContext());

            Test.stopTest();
            result = getScan(scanRecord.Id);
        }

        Assert.areEqual(AccountDataQualityScanService.STATUS_FAILED, result.Status__c, '非同期失敗を保存する必要あり');
        Assert.areEqual(AccountDataQualityScanService.SAFE_FAILURE_MESSAGE, result.Error_Message__c, '内部例外を公開しない文言で保存する必要あり');
        Assert.isNull(result.Active_Key__c, '失敗後に再実行を許可する必要あり');
        Assert.isNotNull(result.Completed_At__c, '失敗を確定した時刻を保存する必要あり');
    }

    /**
     * Cursorがない初回ジョブを登録しない
     */
    @IsTest
    static void shouldRejectInitialJobWithoutCursor() {

        System.runAs(testUser) {
            DataQualityScan__c scanRecord = createPendingScan(0);
            insert scanRecord;
            AccountDataQualityScanQueueable job = new AccountDataQualityScanQueueable(null, 0, scanRecord.Id);
            Test.startTest();
            try {
                job.enqueueInitialJob();
                Assert.fail('Cursorがないジョブは登録を拒否する必要あり');
            } catch (AccountDataQualityScanService.ScanException e) {
                Assert.areEqual('スキャンを開始するための状態がありません。', e.getMessage(), '初期状態の不足を明示する必要あり');
            }
            Assert.areEqual(0, Limits.getQueueableJobs(), '無効な初期状態ではジョブを登録しない必要あり');
            Test.stopTest();
        }
    }

    /**
     * スキャンIDがない初回ジョブを登録しない
     */
    @IsTest
    static void shouldRejectInitialJobWithoutScanId() {

        System.runAs(testUser) {
            Database.Cursor accountCursor = new AccountDataQualityScanSelector().createAccountCursor();
            AccountDataQualityScanQueueable job = new AccountDataQualityScanQueueable(accountCursor, 0, null);
            Test.startTest();
            try {
                job.enqueueInitialJob();
                Assert.fail('スキャンIDがないジョブは登録を拒否する必要あり');
            } catch (AccountDataQualityScanService.ScanException e) {
                Assert.areEqual('スキャンを開始するための状態がありません。', e.getMessage(), '初期状態の不足を明示する必要あり');
            }
            Assert.areEqual(0, Limits.getQueueableJobs(), '無効な初期状態ではジョブを登録しない必要あり');
            Test.stopTest();
        }
    }

    /**
     * 未処理例外で終了したQueueableの実行結果を返すテストコンテキスト
     */
    private class FailedFinalizerContext implements FinalizerContext {
        /**
         * 永続化しないテストジョブのIDを返却
         * @return ジョブ未登録のためnull
         */
        public Id getAsyncApexJobId() {
            return null;
        }

        /**
         * テスト用リクエスト識別子を返却
         * @return 固定のテスト用識別子
         */
        public String getRequestId() {
            return 'quality-scan-test-request';
        }

        /**
         * 非同期ジョブの未処理例外を通知
         * @return 未処理例外の終了状態
         */
        public ParentJobResult getResult() {
            return ParentJobResult.UNHANDLED_EXCEPTION;
        }

        /**
         * 利用者向け文言に含めない内部障害を返却
         * @return テスト用の内部例外
         */
        public Exception getException() {
            return new AccountDataQualityScanService.ScanException('内部障害の詳細');
        }
    }

    private static DataQualityScan__c getScan(Id scanId) {
        return [
            SELECT Status__c, Active_Key__c, Processed_Count__c, Missing_Phone_Count__c,
                Missing_Website_Count__c, Completed_At__c, Error_Message__c
            FROM DataQualityScan__c
            WHERE Id = :scanId
        ];
    }

    /**
     * 区間処理の開始前となるスキャンを作成
     * @param totalCount 区間処理で読み取る対象件数
     * @return 保存前の実行待ちスキャン
     */
    private static DataQualityScan__c createPendingScan(Integer totalCount) {
        DataQualityScan__c scan = EMPTY_SCAN.clone();
        scan.Status__c = AccountDataQualityScanService.STATUS_PENDING;
        scan.Total_Count__c = totalCount;
        scan.Started_At__c = System.now();
        scan.Requested_By__c = UserInfo.getUserId();
        scan.Active_Key__c = AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY;
        return scan;
    }

    /** 継続時にCursorが失われていた場合は集計を進めない */
    @IsTest
    static void rejectsMissingCursorDuringExecution() {

        System.runAs(testUser) {
            DataQualityScan__c scan = createPendingScan(0);
            insert scan;
            Test.startTest();
            System.enqueueJob(new AccountDataQualityScanQueueable(null, 0, scan.Id));
            try {
                Test.stopTest();
                Assert.fail('Cursorのない継続処理を拒否');
            } catch (AccountDataQualityScanService.ScanException e) {
                Assert.isTrue(e.getMessage().contains('継続するための状態'), '失われた状態を通知');
            }
        }
    }

}
