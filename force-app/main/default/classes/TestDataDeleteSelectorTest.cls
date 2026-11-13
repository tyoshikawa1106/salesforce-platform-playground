/** 指定ジョブと対象の残存確認を検証 */
@IsTest
private with sharing class TestDataDeleteSelectorTest {

    private static TestDataDeleteSelector selector = new TestDataDeleteSelector();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** ジョブID未指定では最新ジョブを取得しない */
    @IsTest
    static void nullJobDoesNotSelectLatest() {

        System.runAs(testUser) {
            Test.startTest();
            Integer beforeQueries = Limits.getQueries();
            Assert.isTrue(selector.getJobs(null).isEmpty(), '未指定で履歴を取得しない');
            Assert.areEqual(beforeQueries, Limits.getQueries(), '不要な検索をしない');
            Test.stopTest();
        }
    }

    /** 名称で絞り込まず全レコードを集計 */
    @IsTest
    static void countsAllNames() {

        System.runAs(testUser) {
            insert new Account(Name = '手作業相当');
            Test.startTest();
            Integer remaining = selector.getRemaining('Account');
            List<UserPermissionAccess> permissions = selector.getPermissions();
            List<AsyncApexJob> active = selector.getActiveJobs();
            Test.stopTest();
            Assert.areEqual(1, remaining, '名称で絞らない');
            Assert.areEqual(1, permissions.size(), '実効権限を取得');
            Assert.isTrue(active.isEmpty(), '未起動');
        }
    }
    /** 登録済みジョブを実行せず検索条件を確認 */
    @IsTest
    static void queriesRegisteredDeleteJob() {

        System.runAs(testUser) {
            Test.startTest();
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(new TestDataDeleteBatchWrapper()), 200);
            List<Organization> organizations = selector.getOrganizations();
            Assert.areEqual(1, organizations.size(), '現在組織の判定情報を取得');
            Assert.areEqual(jobId, selector.getJobs(jobId)[0].Id, '指定された同機能ジョブだけを取得');
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

}
