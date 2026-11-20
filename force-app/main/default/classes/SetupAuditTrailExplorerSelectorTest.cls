@IsTest
private class SetupAuditTrailExplorerSelectorTest {
    /** 指定日時より後の従業員操作を判定根拠に含めない。 */
    @IsTest
    static void excludesEmployeeActionsAfterCutoff() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectEmployeeActions(
                Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0)
            );
            Test.stopTest();
            Assert.isTrue(rows.isEmpty(), '保持期間より前なら照合元の履歴はありません。');
        }
    }

    @IsTest
    static void countsHistoryInMonth() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Datetime startAt = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
            SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
            criteria.startAt = startAt;
            criteria.endAt = startAt.addMonths(1);
            Test.startTest();
            Integer total = SetupAuditTrailExplorerSelector.countMatches(criteria);
            Test.stopTest();
            Assert.areEqual(0, total, '保持期間外の月は0件です。');
        }
    }

    @IsTest
    static void queriesPageWithFilters() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Datetime startAt = Datetime.newInstanceGMT(2000, 1, 1, 0, 0, 0);
            SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
            criteria.startAt = startAt;
            criteria.endAt = startAt.addDays(1);
            criteria.userId = UserInfo.getUserId();
            criteria.action = 'PermSetCreate';
            criteria.nextId = UserInfo.getUserId();
            criteria.nextTime = startAt;
            Test.startTest();
            List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
                criteria, SetupAuditTrailExplorerSelector.Projection.CHART, 51
            );
            Test.stopTest();
            Assert.areEqual(0, rows.size(), '保持期間外の検索結果は空です。');
        }
    }
}
