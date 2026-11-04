/** AccountDeleteBatchSelectorの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchSelectorTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 同じテストクラスで必要な権限だけを割り当て
     */
    @TestSetup
    static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<PermissionSet> permissions = [SELECT Id FROM PermissionSet WHERE Name = 'LwcAccountDelete'];
        Assert.areEqual(1, permissions.size(), '削除機能のテスト権限が存在');
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = permissions[0].Id);
    }

    /** 削除対象と標準ジョブを取得 */
    @IsTest
    static void selectsAccountsAndStandardJob() {

        System.runAs(testUser) {
            insert new Account(Name = '対象');
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