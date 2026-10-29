/** 指定ジョブと対象の残存確認を検証 */
@IsTest
private with sharing class TestDataDeleteSelectorTest {

    private static TestDataDeleteSelector selector = new TestDataDeleteSelector();

    private static User testUser = TestDataFactory.getTestUser();

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
            TestDataFactory.createAccount('手作業相当', TestDataFactory.SaveMode.INSERT_RECORD);
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
}