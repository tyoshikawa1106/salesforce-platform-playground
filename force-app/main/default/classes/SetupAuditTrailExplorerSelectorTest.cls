@IsTest
private class SetupAuditTrailExplorerSelectorTest {
    /** 照合用の取得は代理ログイン・ログアウトに限定する。 */
    @IsTest
    static void selectsOnlyDelegatedHistory() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
            criteria.endAt = System.now();
            Test.startTest();
            List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
                criteria, SetupAuditTrailExplorerSelector.Projection.LOGIN_AS, 2
            );
            Test.stopTest();
            Set<String> actions = new Set<String>{'suOrgAdminLogin', 'suOrgAdminLogout'};
            Assert.isTrue(rows.size() <= 2, '照合にもページ上限を適用します。');
            for (SetupAuditTrail row : rows) {
                Assert.isTrue(actions.contains(row.Action), '代理操作だけを返します。');
            }
        }
    }

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
    static void returnsNoRecordsForEmptySelection() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
            criteria.endAt = System.now();
            criteria.recordIds = new List<Id>();
            Test.startTest();
            List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
                criteria, SetupAuditTrailExplorerSelector.Projection.DETAIL, 200
            );
            Test.stopTest();
            Assert.isTrue(rows.isEmpty(), '空の選択を未指定として扱いません。');
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
