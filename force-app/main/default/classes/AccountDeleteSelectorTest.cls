/** AccountDeleteSelectorの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteSelectorTest {

    private static AccountDeleteSelector selector = new AccountDeleteSelector();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 実行者自身の最新ジョブだけを取得 */
    @IsTest
    static void selectsOnlyOwnLatestJob() {
        User otherUser = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'Delete job owner test',
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
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            Assert.areEqual(jobId, selector.getJobs(null)[0].Id, '自身のジョブ');

            System.runAs(otherUser) {
                Assert.isTrue(selector.getJobs(null).isEmpty(), '他者のジョブは非公開');
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
            LastName = 'Delete job owner test',
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
            Assert.areEqual(firstId, selector.getJobs(firstId)[0].Id, '後続ジョブではなく指定したジョブを取得');

            System.runAs(otherUser) {
                Assert.isTrue(selector.getJobs(firstId).isEmpty(), 'ID指定でも他者のジョブを取得しない');
            }
            System.abortJob(secondId);
            Assert.areEqual(firstId, selector.getJobs(firstId)[0].Id, '後続ジョブの終了後も指定IDを維持');
            Test.stopTest();
        }
    }

    /** 登録済みの削除ジョブだけを重複判定対象にする */
    @IsTest
    static void findsActiveDeleteJob() {

        System.runAs(testUser) {
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            List<AsyncApexJob> jobs = selector.getActiveJobs();
            Assert.areEqual(1, jobs.size(), '登録したジョブを検出');
            Assert.areEqual(jobId, jobs[0].Id, '同じ機能のジョブを取得');
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

}
