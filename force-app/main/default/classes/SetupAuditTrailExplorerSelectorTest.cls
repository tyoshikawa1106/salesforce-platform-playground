@IsTest
private class SetupAuditTrailExplorerSelectorTest {
    @IsTest
    static void countsHistoryInMonth() {
        Datetime startAt = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
        Test.startTest();
        Integer total = SetupAuditTrailExplorerSelector.countMonth(startAt, startAt.addMonths(1));
        Test.stopTest();
        Assert.areEqual(0, total, '保持期間外の月は0件です。');
    }

    @IsTest
    static void queriesPageWithFilters() {
        Datetime startAt = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
        Test.startTest();
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            startAt, startAt.addDays(1), UserInfo.getUserId(), 'PermSetCreate', null, null, UserInfo.getUserId(), startAt, true, 51
        );
        Test.stopTest();
        Assert.areEqual(0, rows.size(), '保持期間外の検索結果は空です。');
    }
    @IsTest
    static void readsTowardsNewerRecordsFromTailCursor() {
        Datetime startAt = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
        Id userId = UserInfo.getUserId();
        Test.startTest();
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectTail(
            startAt, startAt.addDays(1), userId, 'PermSetCreate', null, null, userId, startAt, 50
        );
        Test.stopTest();
        Assert.isTrue(rows.isEmpty(), '保持期間外のページは空です。');
    }
}