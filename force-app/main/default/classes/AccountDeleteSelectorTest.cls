/** AccountDeleteSelectorの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void selectsOnlyOwnLatestJob() {
        grantAccess();
        User denied = createDeniedUser();
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
        User otherUser = createDeniedUser();
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

    private static void grantAccess() {
        Id permissionId = [SELECT Id FROM PermissionSet WHERE Name = 'AccountDelete' LIMIT 1].Id;
        if (
            [
                SELECT COUNT()
                FROM PermissionSetAssignment
                WHERE AssigneeId = :UserInfo.getUserId() AND PermissionSetId = :permissionId
            ] == 0
        ) {
            insert new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(), PermissionSetId = permissionId);
        }
    }

    private static User createDeniedUser() {
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'deltest',
            LastName = 'Delete permission test',
            Email = 'delete-test@example.invalid',
            Username = 'delete-test.' +
                UserInfo.getOrganizationId() +
                '.' +
                System.now().getTime() +
                '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert denied;
        return denied;
    }
}