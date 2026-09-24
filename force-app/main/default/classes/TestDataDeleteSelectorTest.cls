/** 指定ジョブと対象の残存確認を検証 */
@IsTest
private with sharing class TestDataDeleteSelectorTest {
    @IsTest
    static void nullJobDoesNotSelectLatest() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteSelector selector = new TestDataDeleteSelector();
            Integer beforeQueries = Limits.getQueries();
            Assert.isTrue(selector.getJobs(null).isEmpty(), '未指定で履歴を取得しない');
            Assert.areEqual(beforeQueries, Limits.getQueries(), '不要な検索をしない');
        }
    }
    @IsTest
    static void countsAllNames() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataFactory.createAccount('手作業相当', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            TestDataDeleteSelector selector = new TestDataDeleteSelector();
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