/** AccountDeleteSelectorの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void selectsOnlyOwnLatestJob() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        User denied = TestDataFactory.createUser('Delete permission test', TestDataFactory.SaveMode.INSERT_RECORD);
        System.runAs(testUser) {
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            Assert.areEqual(jobId, new AccountDeleteSelector().getJobs(null)[0].Id, '自身のジョブ');
            System.runAs(denied) {
                Assert.isTrue(new AccountDeleteSelector().getJobs(null).isEmpty(), '他者のジョブは非公開');
            }
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

    @IsTest
    static void keepsRequestedJobWhenAnotherJobExists() {
        User otherUser = TestDataFactory.createUser('Delete permission test', TestDataFactory.SaveMode.INSERT_RECORD);
        System.runAs(testUser) {
            Test.startTest();
            Id firstId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            System.abortJob(firstId);
            Id secondId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            AccountDeleteSelector selector = new AccountDeleteSelector();
            Assert.areEqual(firstId, selector.getJobs(firstId)[0].Id, '後続ジョブではなく指定したジョブを取得');
            System.runAs(otherUser) {
                Assert.isTrue(selector.getJobs(firstId).isEmpty(), 'ID指定でも他者のジョブを取得しない');
            }
            System.abortJob(secondId);
            Assert.areEqual(firstId, selector.getJobs(firstId)[0].Id, '後続ジョブの終了後も指定IDを維持');
            Test.stopTest();
        }
    }
}