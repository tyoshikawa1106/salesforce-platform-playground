@IsTest
private class SetupAuditTrailExplorerControllerTest {
    /** 照合履歴の上限は未指定なら組織時刻で決まり、指定済みなら維持される。 */
    @IsTest
    static void fixesLoginAsHistoryCutoff() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Datetime past = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
            Test.startTest();
            Datetime beforeRequest = System.now();
            SetupAuditTrailExplorerWrapper first = SetupAuditTrailExplorerController.loadLoginAsHistory(null, null, null);
            SetupAuditTrailExplorerWrapper historical = SetupAuditTrailExplorerController.loadLoginAsHistory(past, null, null);
            Test.stopTest();
            Assert.isTrue(first.cutoff >= beforeRequest && first.cutoff <= System.now(), '初回の取得上限は組織時刻です。');
            Assert.areEqual(past, historical.cutoff, '指定した上限で照合します。');
            Assert.isTrue(historical.records.isEmpty(), '指定日時以降の行を含みません。');
        }
    }

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

    /** 初回はSalesforceが照会時に決めた上限を返す。 */
    @IsTest
    static void startsExportAtServerTime() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            Datetime beforeRequest = System.now();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.exportAllHistory(null, null, null);
            Datetime afterRequest = System.now();
            Test.stopTest();
            Assert.isTrue(result.cutoff >= beforeRequest && result.cutoff <= afterRequest, '取得上限は初回要求を処理した組織の時刻です。');
        }
    }

    /** 続きのページは引き継いだ取得上限を適用し、同じ値を返す。 */
    @IsTest
    static void preservesExportCutoffOnLaterPages() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Datetime cutoff = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.exportAllHistory(
                cutoff, UserInfo.getUserId(), System.now()
            );
            Test.stopTest();
            Assert.areEqual(cutoff, result.cutoff, '続きのページでも初回の取得上限を維持します。');
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
    static void readsEmptyMatchIndex() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
                '{"monthStart":"2000-01-01","matchIndex":true}'
            );
            Test.stopTest();
            Assert.isTrue(result.records.isEmpty(), '対象がない月の照合は空です。');
            Assert.isNull(result.nextId, '照合は最終ページで終了します。');
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
