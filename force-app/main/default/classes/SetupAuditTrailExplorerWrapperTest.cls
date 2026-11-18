@IsTest
private class SetupAuditTrailExplorerWrapperTest {
    @IsTest
    static void initializesEmptyCollections() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrailExplorerWrapper result = new SetupAuditTrailExplorerWrapper();
            Assert.areEqual(0, result.records.size(), '一覧を空で初期化します。');
            Assert.areEqual(0, result.buckets.size(), '集計を空で初期化します。');
        }
    }
}