/** AccountDeleteBatchSelectorの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void selectsAccountsAndStandardJob() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            TestDataFactory.createAccount('対象', TestDataFactory.SaveMode.INSERT_RECORD);
            AccountDeleteBatchSelector selector = new AccountDeleteBatchSelector();
            Test.startTest();
            Assert.isTrue(selector.getAccounts().iterator().hasNext(), '参照可能な取引先');
            Assert.isFalse(selector.getNoAccounts().iterator().hasNext(), '拒否時の空結果');
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            Assert.areEqual(jobId, selector.getJobs(jobId)[0].Id, '対応ジョブ');
            Assert.areEqual(1, selector.getActiveJobs().size(), '実行中を検出');
            System.abortJob(jobId);
            Test.stopTest();
        }
    }
}