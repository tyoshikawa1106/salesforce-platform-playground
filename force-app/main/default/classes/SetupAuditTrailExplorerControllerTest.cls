@IsTest
private class SetupAuditTrailExplorerControllerTest {
    @IsTest
    static void exportsEmptyMonthAsCsv() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
                JSON.serialize(new Map<String, Object>{ 'monthStart' => Date.newInstance(2000, 1, 1), 'csv' => true })
            );
            Test.stopTest();
            Assert.areEqual(0, result.records.size(), '保持期間外の月のCSV対象履歴はありません。');
            Assert.isNull(result.nextId, '0件なら続きのページはありません。');
        }
    }

    @IsTest
    static void exportsNoHistoryBeforeRetention() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.exportAllHistory(
                Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0), null, null
            );
            Test.stopTest();
            Assert.isTrue(result.records.isEmpty(), '指定した基準日時より前の対象履歴はありません。');
            Assert.isNull(result.nextId, '0件なら続きのページはありません。');
        }
    }

    @IsTest
    static void loadsDistinctFilterOptionsForTheRequestedMonth() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.loadDistinctFilterOptions(
                Date.newInstance(2000, 1, 1), null, null
            );
            Test.stopTest();
            Assert.isTrue(result.options.get('action').isEmpty(), '保持期間外の月に候補はありません。');
            Assert.isTrue(result.buckets.isEmpty(), '候補の応答に分析用のデータを含めません。');
            Assert.isNull(result.nextId, '0件なら続きはありません。');
        }
    }

    @IsTest
    static void countsEmptyMonth() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            Integer total = SetupAuditTrailExplorerController.countMonth(Date.newInstance(2000, 1, 1));
            Test.stopTest();
            Assert.areEqual(0, total, '保持期間外の月の総件数は0です。');
        }
    }

    @IsTest
    static void loadsEmptyMonth() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
                JSON.serialize(new Map<String, Object>{ 'monthStart' => Date.newInstance(2000, 1, 1) })
            );
            Test.stopTest();
            Assert.areEqual(0, result.records.size(), '保持期間外の履歴は空です。');
        }
    }

    @IsTest
    static void loadsEmptyChartDay() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
                JSON.serialize(new Map<String, Object>{
                    'monthStart' => Date.newInstance(2000, 1, 1), 'day' => Date.newInstance(2000, 1, 2), 'chart' => true
                })
            );
            Test.stopTest();
            Assert.areEqual(0, result.buckets.size(), '保持期間外の集計は空です。');
        }
    }
    @IsTest
    static void countsEmptySearch() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Date month = Date.newInstance(2000, 1, 1);
            Id userId = UserInfo.getUserId();
            Test.startTest();
            Integer total = SetupAuditTrailExplorerController.countMatches(
                JSON.serialize(new Map<String, Object>{ 'monthStart' => month, 'day' => month, 'userId' => userId, 'action' => 'PermSetCreate' })
            );
            Test.stopTest();
            Assert.areEqual(0, total, '検索条件に該当する履歴はありません。');
        }
    }
}
