/**
 * 対象IDと参照項目を限定した組織探索の照会
 */
@IsTest
private with sharing class OrgExplorerSelectorTest {

    private static User testUser = new User(Id = UserInfo.getUserId());
    private static OrgExplorerSelector selector = new OrgExplorerSelector();

    /**
     * 上司ID集合が未指定なら全ユーザーを照会しない
     */
    @IsTest
    static void skipsEmptyManagerQueries() {
        System.runAs(testUser) {
            List<String> fields = new OrgExplorerAccessPolicy().getUserFields('MANAGER_STRUCTURE');
            Test.startTest();
            List<User> parentResult = selector.selectManagerParentUser(null);
            List<User> nullResult = selector.selectManagers(null, fields, 'ALL');
            List<User> emptyResult = selector.selectManagers(new Set<Id>(), fields, 'ALL');
            Integer queryCount = Limits.getQueries();
            Test.stopTest();
            Assert.isTrue(
                parentResult.isEmpty() && nullResult.isEmpty() && emptyResult.isEmpty(),
                '未指定は空の結果にする'
            );
            Assert.areEqual(0, queryCount, '対象集合がない問い合わせを実行しない');
        }
    }

    /**
     * 起点の可視確認はIDだけを一回で取得
     */
    @IsTest
    static void readsOnlyParentIdForVisibility() {
        System.runAs(testUser) {
            Test.startTest();
            List<User> records = selector.selectManagerParentUser(testUser.Id);
            Integer queryCount = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual(1, records.size(), '参照可能な起点を取得できる');
            Assert.areEqual(testUser.Id, records[0].Id, '指定したユーザーだけを取得する');
            Assert.areEqual(
                new Set<String>{ 'Id' },
                records[0].getPopulatedFieldsAsMap().keySet(),
                '表示項目を余分に取得しない'
            );
            Assert.areEqual(1, queryCount, '可視性を一回の照会で確認する');
        }
    }

    /**
     * 親の参照確認はIDだけに限定し、表示用のロール名と分離
     */
    @IsTest
    static void limitsParentReferenceFields() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Name = '参照確認ロール');
            insert role;
            Test.startTest();
            List<UserRole> noIds = selector.selectRoles(null, new List<String>{ 'Id' });
            List<UserRole> empty = selector.selectRoles(new Set<Id>(), new List<String>{ 'Id' });
            Integer skippedQueries = Limits.getQueries();
            List<UserRole> references = selector.selectRoles(new Set<Id>{ role.Id }, new List<String>{ 'Id' });
            List<User> parents = selector.selectManagers(new Set<Id>{ testUser.Id }, new List<String>{ 'Id' }, 'ALL');
            List<UserRole> namedRoles = selector.selectRoles(new Set<Id>{ role.Id }, new List<String>{ 'Id', 'Name' });
            Test.stopTest();
            Assert.isTrue(noIds.isEmpty() && empty.isEmpty(), '未指定は全件取得へ変換しない');
            Assert.areEqual(0, skippedQueries, '空の親確認では照会しない');
            Assert.areEqual(new Set<String>{ 'Id' }, references[0].getPopulatedFieldsAsMap().keySet(), '親ロールに名称や関係項目を取得しない');
            Assert.areEqual(new Set<String>{ 'Id' }, parents[0].getPopulatedFieldsAsMap().keySet(), '親上司の表示項目を取得しない');
            Assert.areEqual(new Set<String>{ 'Id', 'Name' }, namedRoles[0].getPopulatedFieldsAsMap().keySet(), 'ロール表示には名称だけを補足する');
        }
    }

    /**
     * 複数の上司を固定回数で集計し、所属と親を欠落させない
     */
    @IsTest
    static void loadsManagersWithoutPerUserQueries() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Name = '一括試験ロール');
            insert role;
            User root = createUser('一括試験最上位');
            root.IsActive = false;
            insert root;
            Map<String, List<User>> team = createManagerTeam(root, role);
            List<User> managers = team.get('managers');
            List<User> members = team.get('members');
            Test.startTest();
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.includeInactive = true;
            List<AggregateResult> groups = selector.selectManagerGroups(request, null);
            Set<Id> ids = new Set<Id>{ root.Id };
            ids.addAll(new Map<Id, User>(managers).keySet());
            List<User> records = selector.selectManagers(
                ids,
                new List<String>{ 'Id', 'ManagerId', 'UserRoleId' },
                'ALL'
            );
            List<UserRole> roles = selector.selectRoles(new Set<Id>{ role.Id }, new List<String>{ 'Id', 'Name' });
            Integer queryCount = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual(3, queryCount, '集計・上司・所属ロールを固定回数で照会');
            Map<Id, User> nodes = new Map<Id, User>(records);
            Map<Id, Integer> counts = new Map<Id, Integer>();
            for (AggregateResult groupRecord : groups) {
                counts.put((Id) groupRecord.get('managerId'), (Integer) groupRecord.get('memberCount'));
            }
            Assert.areEqual(role.Id, roles[0].Id, '共通ロールを一括取得');
            for (User manager : managers) {
                Assert.isTrue(nodes.containsKey(manager.Id), '一括取得した上司を欠落させない');
                Assert.areEqual(root.Id, nodes.get(manager.Id).ManagerId, '上位ユーザーの関連IDを保持');
                Assert.areEqual(1, counts.get(manager.Id), '直属部下だけを集計');
                Assert.areEqual(role.Id, nodes.get(manager.Id).UserRoleId, '所属ロールの関連IDを保持');
            }
            for (User member : members) {
                Assert.isFalse(nodes.containsKey(member.Id), '一般メンバーを上司の照会へ混ぜない');
            }
        }
    }

    /**
     * 直接所属の人数を表示条件に従って集計し、親とゼロ件を含める
     */
    @IsTest
    static void countsVisibleRoleMembersWithinPageBudget() {
        System.runAs(testUser) {
            UserRole root = new UserRole(Name = '集計会社', DeveloperName = 'CountCompany');
            insert root;
            List<UserRole> roles = new List<UserRole>{
                new UserRole(Name = '集計営業部', DeveloperName = 'CountSales', ParentRoleId = root.Id),
                new UserRole(Name = '集計総務部', DeveloperName = 'CountAdmin', ParentRoleId = root.Id),
                new UserRole(Name = '別会社', DeveloperName = 'CountOther')
            };
            insert roles;
            testUser.UserRoleId = root.Id;
            update testUser;
            List<User> users = new List<User>();
            for (Integer index = 0; index < 3; index++) {
                User record = createUser('人数集計' + index);
                record.IsActive = false;
                record.UserRoleId = roles[index == 2 ? 2 : 0].Id;
                users.add(record);
            }
            insert users;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'count-page';
            request.mode = 'ROLE';
            request.scope = 'ROLE_STRUCTURE';
            request.parentId = root.Id;
            Test.startTest();
            Set<Id> roleIds = new Set<Id>{ root.Id, roles[0].Id, roles[1].Id, roles[2].Id };
            List<AggregateResult> active = selector.countRoleMembers(roleIds, request);
            request.includeInactive = true;
            List<AggregateResult> allUsers = selector.countRoleMembers(roleIds, request);
            Integer beforeRows = Limits.getQueryRows();
            Integer beforeQueries = Limits.getQueries();
            List<AggregateResult> grouped = selector.countRoleMembers(new Set<Id>{ root.Id, roles[0].Id }, request);
            Assert.areEqual(1, Limits.getQueries() - beforeQueries, '対象ロールを一括で集計');
            Assert.areEqual(grouped.size(), Limits.getQueryRows() - beforeRows, '人数ではなくグループ数を消費');
            Integer emptyQueries = Limits.getQueries();
            Assert.isTrue(selector.countRoleMembers(new Set<Id>(), request).isEmpty(), '空範囲は集計しない');
            Assert.areEqual(emptyQueries, Limits.getQueries(), '空範囲ではSOQLなし');
            Test.stopTest();
            Map<Id, Integer> activeCounts = countMap(active);
            Map<Id, Integer> allCounts = countMap(allUsers);
            Assert.areEqual(1, activeCounts.get(root.Id), '親の直接所属人数も返す');
            Assert.isFalse(activeCounts.containsKey(roles[0].Id), '無効を除外');
            Assert.areEqual(2, allCounts.get(roles[0].Id), '直接所属の無効ユーザーを含む');
            Assert.isFalse(allCounts.containsKey(roles[1].Id), 'ゼロ件ロールの集計行を捏造しない');
            Assert.areEqual(1, allCounts.get(roles[2].Id), '別の枝も一括集計');
        }
    }

    private static Map<Id, Integer> countMap(List<AggregateResult> groups) {
        Map<Id, Integer> result = new Map<Id, Integer>();
        for (AggregateResult groupRecord : groups) {
            result.put((Id) groupRecord.get('targetId'), (Integer) groupRecord.get('memberCount'));
        }
        return result;
    }

    /**
     * 親と複数の子ロールを固定回数で取得し、境界から継続
     */
    @IsTest
    static void loadsRoleBranchesWithBoundedQueries() {
        System.runAs(testUser) {
            List<UserRole> existingRoles = [SELECT Id FROM UserRole ORDER BY Id DESC LIMIT 1];
            Id boundary = existingRoles.isEmpty()
                ? Id.valueOf(
                      UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000000'
                  )
                : existingRoles[0].Id;
            UserRole root = new UserRole(Name = '構造試験会社', DeveloperName = 'StructureCompany');
            insert root;
            List<UserRole> roles = new List<UserRole>{
                new UserRole(Name = '構造試験部門A', ParentRoleId = root.Id),
                new UserRole(Name = '構造試験部門B', ParentRoleId = root.Id)
            };
            insert roles;
            User inactive = createUser('構造人数試験');
            inactive.IsActive = false;
            inactive.UserRoleId = roles[0].Id;
            insert inactive;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.includeInactive = true;
            Test.startTest();
            Integer beforeQueries = Limits.getQueries();
            List<UserRole> records = selector.selectRoleStructurePage(boundary);
            Set<Id> ids = new Map<Id, UserRole>(records).keySet();
            List<AggregateResult> counts = selector.countRoleMembers(ids, request);
            Integer queryCost = Limits.getQueries() - beforeQueries;
            request.includeInactive = false;
            List<AggregateResult> activeOnly = selector.countRoleMembers(ids, request);
            List<UserRole> next = selector.selectRoleStructurePage(root.Id);
            Test.stopTest();
            Assert.areEqual(2, queryCost, '構造と人数をそれぞれ一括照会');
            Assert.areEqual(3, records.size(), '親と複数の子を一度に取得');
            Assert.areEqual(
                new Map<Id, UserRole>(roles).keySet(),
                new Map<Id, UserRole>(next).keySet(),
                '取得済みの境界を除いて子ロールから継続'
            );
            Assert.areEqual(1, countMap(counts).get(roles[0].Id), '直接所属の無効ユーザーを集計');
            Assert.isFalse(countMap(activeOnly).containsKey(roles[0].Id), '有効条件で除外');
            Assert.isTrue(ids.contains(root.Id), '起点も同じ構造取得に含む');
            Assert.isTrue(ids.containsAll(new Map<Id, UserRole>(roles).keySet()), '末端を個別照会せず全件取得');
        }
    }

    // 一括照会を検証する上司・部下の関連を準備
    private static Map<String, List<User>> createManagerTeam(User root, UserRole role) {
        List<User> managers = new List<User>();
        for (Integer index = 0; index < 2; index++) {
            User manager = createUser('一括上司' + index);
            manager.IsActive = false;
            manager.ManagerId = root.Id;
            manager.UserRoleId = role.Id;
            managers.add(manager);
        }
        insert managers;
        List<User> members = new List<User>();
        for (User manager : managers) {
            User member = createUser('一括部下');
            member.IsActive = false;
            member.ManagerId = manager.Id;
            members.add(member);
        }
        insert members;
        return new Map<String, List<User>>{ 'managers' => managers, 'members' => members };
    }

    /**
     * 一ロール・一メンバーで候補と標準ページングを直接確認
     */
    @IsTest
    static void queriesCandidatesAndMemberPageDirectly() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Name = '単体候補', DeveloperName = 'UnitCandidate');
            insert role;
            User member = createUser('単体メンバー');
            member.IsActive = false;
            member.UserRoleId = role.Id;
            member.ManagerId = testUser.Id;
            insert member;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.mode = 'ROLE';
            request.parentId = role.Id;
            request.includeInactive = true;
            OrgExplorerSearchRequest search = new OrgExplorerSearchRequest();
            search.term = '単体';
            search.activityFilter = 'ALL';
            Test.startTest();
            Assert.isTrue(selector.selectUsers(null, new List<String>{ 'Id' }).isEmpty(), '未指定は照会しない');
            Assert.areEqual(member.Id, selector.selectUsers(new Set<Id>{ member.Id }, new List<String>{ 'Id' })[0].Id, '指定ユーザーを取得');
            Assert.areEqual(role.Id, selector.searchRoles('', 'UnitCandidate')[0].Id, 'API名で候補を取得');
            Assert.areEqual(role.Id, selector.searchRoles('単体', '')[0].Id, '前方一致で候補を取得');
            Assert.isFalse(selector.searchRoles('', '').isEmpty(), '未入力で最上位候補を取得');
            Database.PaginationCursor cursor = selector.createMemberCursor(request);
            Database.CursorFetchResult fetched = selector.fetchMemberPage(cursor, 0, 1);
            Set<Id> ids = new Set<Id>{ member.Id };
            Assert.areEqual(member.Id, selector.selectMemberRecords(request, new List<String>{ 'Id' }, ids)[0].Id, 'ページ内のユーザーを再確認');
            Assert.isTrue(selector.selectMemberRecords(request, new List<String>{ 'Id' }, new Set<Id>()).isEmpty(), '空ページを照会しない');
            Assert.isNull(selector.fetchMemberPage(cursor, 0, 0), '空集合で取得しない');
            Assert.areEqual(1, fetched.getRecords().size(), '一件ずつ取得');
            Assert.isTrue(selector.selectProfiles(new Set<Id>()).isEmpty(), '関連先なしで照会しない');
            Assert.areEqual(member.ProfileId, selector.selectProfiles(new Set<Id>{ member.ProfileId })[0].Id, '指定プロファイルを取得');
            Assert.isFalse(selector.selectManagerGroups(request, (Id) (User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000000')).isEmpty(), '境界以降の上司を照会');
            request.includeInactive = false;
            selector.selectManagerGroups(request, null);
            selector.searchManagerGroups(search);
            search.activityFilter = 'ACTIVE';
            Assert.isTrue(selector.searchManagerGroups(search).isEmpty(), '無効メンバーを候補から除外');
            Assert.isTrue(selector.selectManagers(ids, new List<String>{ 'Id' }, 'ACTIVE').isEmpty(), '無効ユーザーを取得しない');
            Test.stopTest();
        }
    }

    // 階層・所属の検証用ユーザーを未保存で用意
    private static User createUser(String lastName) {
        return new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = lastName,
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
    }
}
