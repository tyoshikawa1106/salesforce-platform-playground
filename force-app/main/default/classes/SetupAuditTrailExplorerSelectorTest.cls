@IsTest
private class SetupAuditTrailExplorerSelectorTest {
    /** 現在の管理者の専用権限をユーザーモードで取得 */
    @IsTest
    static void readsCurrentUserPermission() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            List<UserPermissionAccess> permissions = SetupAuditTrailExplorerSelector.getPermissions();
            Test.stopTest();
            Assert.areEqual(1, permissions.size(), '現在のユーザーの権限を取得');
            Assert.isTrue(permissions[0].PermissionsViewSetupAuditTrail, '履歴の専用権限を取得');
        }
    }

    @IsTest
    static void resolvesDelegateNamesByUsername() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            User viewer = [SELECT Name, Username FROM User WHERE Id = :UserInfo.getUserId() WITH USER_MODE];
            Test.startTest();
            Map<String, String> names = SetupAuditTrailExplorerSelector.selectDelegateNames(
                new Set<String>{viewer.Username.toUpperCase(), 'unknown@example.invalid'}
            );
            Integer queries = Limits.getQueries();
            Map<String, String> empty = SetupAuditTrailExplorerSelector.selectDelegateNames(new Set<String>());
            Assert.areEqual(queries, Limits.getQueries(), '代理操作のないページでは照会しません。');
            Test.stopTest();
            Assert.areEqual(new Map<String, String>{viewer.Username.toLowerCase() => viewer.Name}, names, '照合できたユーザーの氏名だけを返します。');
            Assert.isTrue(empty.isEmpty(), '代理操作がなければ氏名も空です。');
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