/** AccountDeleteSelectorの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteSelectorTest {

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

    /** 実行者自身の最新ジョブだけを取得 */
    @IsTest
    static void selectsOnlyOwnLatestJob() {
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'Delete permission test',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert denied;

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

    /** 別ジョブが存在しても指定したジョブを追跡 */
    @IsTest
    static void keepsRequestedJobWhenAnotherJobExists() {
        User otherUser = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'Delete permission test',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert otherUser;

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