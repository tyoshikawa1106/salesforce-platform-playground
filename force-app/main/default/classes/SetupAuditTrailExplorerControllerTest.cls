@IsTest
private class SetupAuditTrailExplorerControllerTest {
    @IsTest
    static void exportsEmptyMonthAsCsv() {
        Test.startTest();
        SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
            Date.newInstance(2000, 1, 1), null, null, null, null, null, null, null, false, true, null
        );
        Test.stopTest();
        Assert.areEqual(0, result.records.size(), '保持期間外の月のCSV対象履歴はありません。');
        Assert.isNull(result.nextId, '0件なら続きのページはありません。');
    }

    @IsTest
    static void exportsNoHistoryBeforeRetention() {
        Test.startTest();
        SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.exportAllHistory(
            Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0), null, null
        );
        Test.stopTest();
        Assert.isTrue(result.records.isEmpty(), '指定した基準日時より前の対象履歴はありません。');
        Assert.isNull(result.nextId, '0件なら続きのページはありません。');
    }

    @IsTest
    static void loadsDistinctFilterOptionsForTheRequestedMonth() {
        Test.startTest();
        SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.loadDistinctFilterOptions(
            Date.newInstance(2000, 1, 1), null, null
        );
        Test.stopTest();
        Assert.isTrue(result.options.get('action').isEmpty(), '保持期間外の月に候補はありません。');
        Assert.isTrue(result.buckets.isEmpty(), '候補の応答に分析用のデータを含めません。');
        Assert.isNull(result.nextId, '0件なら続きはありません。');
    }

    @IsTest
    static void countsEmptyMonth() {
        Test.startTest();
        Integer total = SetupAuditTrailExplorerController.countMonth(Date.newInstance(2000, 1, 1));
        Test.stopTest();
        Assert.areEqual(0, total, '保持期間外の月の総件数は0です。');
    }

    @IsTest
    static void loadsEmptyMonth() {
        Test.startTest();
        SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
            Date.newInstance(2000, 1, 1), null, null, null, null, null, null, null, false, false, null
        );
        Test.stopTest();
        Assert.areEqual(0, result.records.size(), '保持期間外の履歴は空です。');
    }

    @IsTest
    static void loadsEmptyChartDay() {
        Test.startTest();
        SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
            Date.newInstance(2000, 1, 1), Date.newInstance(2000, 1, 2), null, null, null, null, null, null, true, false, null
        );
        Test.stopTest();
        Assert.areEqual(0, result.buckets.size(), '保持期間外の集計は空です。');
    }
    @IsTest
    static void countsAndLoadsTheTailOfAnEmptySearch() {
        Date month = Date.newInstance(2000, 1, 1);
        Id userId = UserInfo.getUserId();
        Test.startTest();
        Integer total = SetupAuditTrailExplorerController.countMatches(month, month, userId, 'PermSetCreate', null, null);
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerController.loadTail(month, month, userId, 'PermSetCreate', null, null, null, null, 38);
        Test.stopTest();
        Assert.areEqual(0, total, '検索条件に該当する履歴はありません。');
        Assert.isTrue(rows.isEmpty(), '最終ページも空です。');
    }
}