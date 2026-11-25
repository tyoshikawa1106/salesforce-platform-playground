@IsTest
private class SetupAuditTrailExplorerControllerTest {
    @IsTest
    static void returnsLabelsForTheExportedFields() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Map<String, String> labels = SetupAuditTrailExplorerController.getColumnLabels();
            Assert.areEqual(new Set<String>{'CreatedDate', 'Username', 'ResponsibleNamespacePrefix', 'Action', 'Display', 'Section', 'DelegateUser'}, labels.keySet());
            Assert.areEqual(User.Username.getDescribe().getLabel(), labels.get('Username'));
            Assert.areEqual(SetupAuditTrail.Action.getDescribe().getLabel(), labels.get('Action'));
            Assert.areEqual(SetupAuditTrail.Display.getDescribe().getLabel(), labels.get('Display'));
        }
    }

    @IsTest
    static void limitsSearchToEarlierOfCutoffAndPeriodEnd() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            Date month = Date.today().toStartOfMonth();
            Datetime cutoff = SetupAuditTrailExplorerController.startSearch();
            Map<String, Object> query = new Map<String, Object>{ 'monthStart' => month, 'cutoff' => cutoff };
            Assert.areEqual(cutoff, SetupAuditTrailExplorerController.readCriteria(JSON.serialize(query)).endAt);
            query.put('monthStart', month.addMonths(-1));
            Assert.areEqual(SetupAuditTrailExplorerService.midnight(month),
                SetupAuditTrailExplorerController.readCriteria(JSON.serialize(query)).endAt);
            Test.stopTest();
        }
    }

    @IsTest
    static void exportsEmptyMonthAsCsv() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            Datetime beforeRequest = System.now();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerController.load(
                JSON.serialize(new Map<String, Object>{ 'monthStart' => Date.newInstance(2000, 1, 1), 'csv' => true })
            );
            Test.stopTest();
            Assert.isTrue(result.cutoff >= beforeRequest && result.cutoff <= System.now(), '過去月の出力にも出力開始時刻を使います。');
            Assert.areEqual(0, result.records.size(), '保持期間外の月のCSV対象履歴はありません。');
            Assert.isNull(result.nextId, '0件なら続きのページはありません。');
        }
    }

    @IsTest
    static void preservesMonthlyExportCutoff() {
        Datetime cutoff = Datetime.newInstanceGMT(2000, 1, 12, 0, 0, 0);
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            SetupAuditTrailExplorerWrapper page = SetupAuditTrailExplorerController.load(JSON.serialize(
                new Map<String, Object>{ 'monthStart' => Date.newInstance(2000, 1, 1), 'csv' => true, 'cutoff' => cutoff,
                    'nextTime' => cutoff, 'nextId' => UserInfo.getUserId() }
            ));
            Test.stopTest();
            Assert.areEqual(cutoff, page.cutoff, '次ページでも最初の出力時刻を返します。');
        }
    }

    @IsTest
    static void rejectsMalformedSearch() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            try {
                SetupAuditTrailExplorerController.load('{');
                Assert.fail('形式が不正な検索は受け付けません。');
            } catch (AuraHandledException expected) {
                Assert.areEqual(0, Limits.getQueries(), '不正な入力では照会しません。');
            }
            Test.stopTest();
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
    static void rejectsIncompleteLookupCursor() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            try {
                SetupAuditTrailExplorerController.loadOptionsAt('{"monthStart":"2000-01-01","nextTime":"2000-01-02T00:00:00Z"}');
                Assert.fail('候補の続きには日時とIDの両方が必要です。');
            } catch (AuraHandledException expected) {
                Assert.areEqual(0, Limits.getQueries(), '境界を確認してから照会します。');
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void rejectsMissingSourceContinuation() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            Assert.isTrue(rejectsAfterSourceQuery('chart'), 'chart の元ページが0件なら取得を中止します。');
            Assert.isTrue(rejectsAfterSourceQuery('options'), 'options の元ページが0件なら取得を中止します。');
            Assert.isTrue(rejectsAfterSourceQuery('matchIndex'), 'matchIndex の元ページが0件なら取得を中止します。');
            Test.stopTest();
        }
    }

    // 保持期間外の境界を渡し、各経路とも元行の照会直後に取得を中断することを確認する。
    private static Boolean rejectsAfterSourceQuery(String route) {
        Datetime boundary = Datetime.newInstanceGMT(2000, 1, 2, 0, 0, 0);
        Map<String, Object> criteria = new Map<String, Object>{
            'monthStart' => Date.newInstance(2000, 1, 1), 'nextTime' => boundary, 'nextId' => UserInfo.getUserId()
        };
        Integer queries = Limits.getQueries();
        try {
            if (route == 'options') {
                SetupAuditTrailExplorerController.loadOptionsAt(JSON.serialize(criteria));
            } else {
                criteria.put(route, true);
                SetupAuditTrailExplorerController.load(JSON.serialize(criteria));
            }
            return false;
        } catch (AuraHandledException expected) {
            return Limits.getQueries() == queries + 1;
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