/**
 * 組織探索APIのロール階層・上司階層・一覧取得
 */
@IsTest
private with sharing class OrgExplorerControllerTest {

    private static OrgExplorerSelector selector = new OrgExplorerSelector();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * ロール名の制御文字と初期API名を区別して照合
     */
    @IsTest
    static void searchesLiteralRolesAndDefaultApiName() {
        System.runAs(testUser) {
            List<UserRole> roles = new List<UserRole>{
                new UserRole(Name = '探索%文字', DeveloperName = 'LiteralRole'),
                new UserRole(Name = '探索別文字', DeveloperName = 'OtherRole')
            };
            insert roles;
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'role-search';
            request.term = '探索%';
            Test.startTest();
            OrgExplorerPageResponse literal = OrgExplorerController.searchRoles(request);
            request.term = '';
            request.developerName = 'LiteralRole';
            OrgExplorerPageResponse initial = OrgExplorerController.searchRoles(request);
            request.term = '探索';
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('ROLES', request), '固定の公開例外で要求を拒否');
            Test.stopTest();
            Assert.areEqual(1, literal.nodes.size(), 'ワイルドカードで検索範囲を拡大しない');
            Assert.areEqual(roles[0].Id, literal.nodes[0].recordId, '名称が一致した候補だけを返す');
            Assert.areEqual(roles[0].Id, initial.nodes[0].recordId, 'API名完全一致で初期候補を解決');
        }
    }

    /**
     * 未入力候補と一文字前方一致を区別し、不正API名を拒否
     */
    @IsTest
    static void rejectsInvalidRoleLookupConditions() {
        System.runAs(testUser) {
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'role-invalid';
            Test.startTest();
            OrgExplorerPageResponse empty = OrgExplorerController.searchRoles(request);
            request.term = '探';
            OrgExplorerPageResponse shortName = OrgExplorerController.searchRoles(request);
            request.term = '';
            request.developerName = 'Invalid%Name';
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('ROLES', request), '固定の公開例外で要求を拒否');
            request.developerName = 'MissingRoleForExplorerTest';
            OrgExplorerPageResponse missing = OrgExplorerController.searchRoles(request);
            Test.stopTest();
            Assert.isNotNull(empty.nodes, '未入力も正常な候補一覧として返す');
            Assert.isNotNull(shortName.nodes, '一文字の検索も正常な候補一覧として返す');
            Assert.areEqual(0, missing.nodes.size(), '他のロールで初期値を補わない');
        }
    }

    /**
     * 空入力は最上位だけ、名称入力は下位も候補に含める
     */
    @IsTest
    static void searchesRootsOrMatchingDescendants() {
        System.runAs(testUser) {
            UserRole parent = new UserRole(Name = '候補親');
            insert parent;
            UserRole child = new UserRole(Name = '候補子', ParentRoleId = parent.Id);
            insert child;
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'browse-roots';
            Test.startTest();
            OrgExplorerPageResponse roots = OrgExplorerController.searchRoles(request);
            request.term = '候補子';
            OrgExplorerPageResponse matches = OrgExplorerController.searchRoles(request);
            Test.stopTest();
            Set<Id> rootIds = new Set<Id>();
            for (OrgExplorerPageResponse.Node item : roots.nodes) {
                rootIds.add(item.recordId);
            }
            Assert.isTrue(rootIds.contains(parent.Id), '親ロールを候補に含める');
            Assert.isFalse(rootIds.contains(child.Id), '未入力では下位を含めない');
            Assert.areEqual(child.Id, matches.nodes[0].recordId, '名称が一致した下位を返す');
        }
    }

    /**
     * null・異種ID・壊れた継続値を照会前に拒否
     */
    @IsTest
    static void rejectsMalformedRequestsBeforeQuerying() {
        System.runAs(testUser) {
            OrgExplorerPageRequest page = new OrgExplorerPageRequest();
            page.requestId = 'bad-page';
            page.mode = 'MANAGER';
            page.scope = 'ROLE_STRUCTURE';
            Test.startTest();
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('CAPABILITIES', null), '固定の公開例外で要求を拒否');
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('CAPABILITIES', ''), '固定の公開例外で要求を拒否');
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('CAPABILITIES', 'invalid*key'), '固定の公開例外で要求を拒否');
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('PAGE', page), '固定の公開例外で要求を拒否');
            page.mode = 'ROLE';
            page.parentId = testUser.Id;
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('PAGE', page), '固定の公開例外で要求を拒否');
            page.parentId = null;
            page.cursor = 'invalid-base64';
            Assert.areEqual('ページの有効期限または条件が変わりました。再読込してください。', getFailureMessage('PAGE', page), '固定の公開例外で要求を拒否');
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('ROLES', null), '固定の公開例外で要求を拒否');
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('PAGE', null), '固定の公開例外で要求を拒否');
            Integer queries = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual(0, queries, '不正要求ではSOQLを実行しない');
        }
    }

    /**
     * 多数所属ユーザーを欠落・重複なくロール単位にページ取得
     */
    @IsTest
    static void paginatesAllDirectRoleMembers() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Name = '所属一覧試験');
            insert role;
            List<User> members = createInactiveUsers(3);
            for (Integer index = 0; index < members.size(); index++) {
                members[index].UserRoleId = role.Id;
                members[index].FirstName = '';
                members[index].LastName = index == 0 ? 'A順序先頭' : 'B同名境界';
                members[index].Department = '試験部署';
                members[index].Title = '試験役職';
            }
            insert members;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'member-pages';
            request.mode = 'ROLE';
            request.scope = 'ROLE_MEMBERS';
            request.pageSize = 2;
            request.parentId = role.Id;
            request.includeInactive = true;
            List<User> expected = [SELECT Id FROM User WHERE UserRoleId = :role.Id ORDER BY Name, Id];
            Test.startTest();
            OrgExplorerPageResponse first = OrgExplorerController.getPage(request);
            request.paginationCursor = (Database.PaginationCursor) JSON.deserialize(
                JSON.serialize(first.paginationCursor),
                Database.PaginationCursor.class
            );
            OrgExplorerPageResponse revisited = OrgExplorerController.getPage(request);
            Assert.areEqual(
                first.nodes[0].recordId,
                revisited.nodes[0].recordId,
                '標準カーソルをJSON往復して先頭へ戻れる'
            );
            Assert.areEqual(2, revisited.nodes.size(), '先頭復帰でも表示件数を維持');
            OrgExplorerPageResponse second = readNextPage(request, first);
            Test.stopTest();
            assertMemberPages(new List<OrgExplorerPageResponse>{ first, second }, expected);
        }

    }

    /**
     * 機能情報の取得でログインユーザーを照会しない
     */
    @IsTest
    static void readsCapabilitiesWithoutCurrentUserQuery() {
        System.runAs(testUser) {
            String request = 'caps-no-user';
            Test.startTest();
            OrgExplorerCapabilitiesResponse response = OrgExplorerController.getCapabilities(request);
            Integer queries = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual(new OrgExplorerAccessPolicy().getCardFieldLabels(), response.cardFieldLabels, '機能情報に参照可能な項目ラベルを含める');
            Assert.areEqual(0, queries, '自分表示用のユーザー照会を実行しない');
            Assert.isFalse(JSON.serialize(response).contains('currentUserNode'), '廃止した起点を応答しない');
        }
    }

    /**
     * 上司参照の権限不足と対象の非存在を安全に扱う
     */
    @IsTest
    static void rejectsUnavailableManagerParent() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = managerRequest('MANAGER_MEMBERS', fakeId(User.SObjectType));
            Test.startTest();
            Assert.areEqual('対象を表示できません。検索または再読込をお試しください。', getFailureMessage('PAGE', request), '固定の公開例外で要求を拒否');
            Test.stopTest();
        }
    }

    /**
     * 一般メンバーを構造へ含めず直属人数を対応
     */
    @IsTest
    static void returnsManagersAndDirectCounts() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Name = '試験営業ロール');
            insert role;
            List<User> team = createTeam(2, role);
            OrgExplorerPageRequest request = managerRequest('MANAGER_STRUCTURE', null);
            Test.startTest();
            OrgExplorerPageResponse response = OrgExplorerController.getPage(request);
            OrgExplorerPageResponse members = OrgExplorerController.getPage(managerRequest('MANAGER_MEMBERS', team[0].Id));
            Test.stopTest();
            Assert.areEqual(role.Name, members.nodes[0].roleName, '一覧にも可視ロール名を取得する');
            Assert.isTrue(members.memberColumns.contains('roleName'), '上司の一覧だけにロール列を提供する');
            Map<Id, OrgExplorerPageResponse.Node> nodes = indexNodes(response.nodes);
            Assert.isTrue(nodes.containsKey(team[0].Id), '部下を持つ上位管理者を表示');
            Assert.isTrue(nodes.containsKey(team[1].Id), '部下を持つ下位管理者を表示');
            Assert.isFalse(nodes.containsKey(team[2].Id), '一般メンバーは構造へ含めない');
            Assert.areEqual('USER:' + team[0].Id, nodes.get(team[1].Id).parentKey, 'ManagerIdで接続');
            Assert.areEqual(2, response.memberCounts.get(team[1].Id), '子孫でなく直属部下を集計');
            Assert.areEqual('試験営業部', nodes.get(team[1].Id).department, '部署を取得');
            Assert.areEqual('試験課長', nodes.get(team[1].Id).title, '役職を取得');
            Assert.areEqual(
                '試験営業ロール',
                response.cardRoles.get(team[1].Id).get('name'),
                '参照可能な所属ロール名を取得'
            );
            Assert.areEqual('VALUE', response.cardRoles.get(team[1].Id).get('state'), '可視ロールを明示');
            Assert.areEqual('EMPTY', response.cardRoles.get(team[0].Id).get('state'), 'ロール未設定を区別');
        }
    }

    /**
     * 未入力を拒否し、氏名前方一致で下位の上司も取得
     */
    @IsTest
    static void searchesManagerNamesAndRejectsEmptyTerms() {
        System.runAs(testUser) {
            List<User> team = createTeam(1, null);
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'manager-search';
            List<User> targets = [SELECT Name FROM User WHERE Id = :team[1].Id];
            Assert.areEqual(1, targets.size(), '検索対象の氏名を取得');
            User target = targets[0];
            Test.startTest();
            Assert.areEqual('入力内容を確認してください。', getFailureMessage('MANAGERS', request), '固定の公開例外で要求を拒否');
            request.term = target.Name;
            OrgExplorerPageResponse names = OrgExplorerController.searchManagers(request);
            Test.stopTest();
            Assert.areEqual(team[1].Id, names.nodes[0].recordId, '入力で下位の上司も探せる');
        }
    }

    /**
     * 氏名順ページを上司と表示条件へ固定して継続
     */
    @IsTest
    static void paginatesDirectMembersWithoutDuplicates() {
        System.runAs(testUser) {
            User manager = createUser('ページ上司');
            manager.IsActive = false;
            insert manager;
            List<User> members = createInactiveUsers(2);
            for (User member : members) {
                member.ManagerId = manager.Id;
            }
            insert members;
            OrgExplorerPageRequest request = managerRequest('MANAGER_MEMBERS', manager.Id);
            request.pageSize = 1;
            Test.startTest();
            OrgExplorerPageResponse first = OrgExplorerController.getPage(request);
            request.paginationCursor = (Database.PaginationCursor) JSON.deserialize(
                JSON.serialize(first.paginationCursor),
                Database.PaginationCursor.class
            );
            request.startIndex = first.nextIndex;
            OrgExplorerPageResponse second = OrgExplorerController.getPage(request);
            request.includeInactive = false;
            Assert.areEqual('ページの有効期限または条件が変わりました。再読込してください。', getFailureMessage('PAGE', request), '固定の公開例外で要求を拒否');
            request.paginationCursor = null;
            request.startIndex = 0;
            OrgExplorerPageResponse active = OrgExplorerController.getPage(request);
            Test.stopTest();
            Assert.areEqual(1, first.nodes.size(), '引数で一ページ1件に制御');
            Assert.areEqual(2, first.memberTotalCount, '直属部下のカーソル件数を提供');
            Assert.areEqual(first.memberTotalCount, second.memberTotalCount, '継続時も同じ一覧の件数を提供');
            Assert.areEqual(1, second.nodes.size(), '次のページに残りを表示');
            Assert.areNotEqual(first.nodes[0].recordId, second.nodes[0].recordId, '二ページの所属ユーザーに重複なし');
            Assert.isTrue(active.nodes.isEmpty(), '無効メンバーを除外');
            Assert.isTrue(first.memberColumns.contains('isActive'), '有効状態の列を維持');
            Assert.areEqual(manager.Id, first.nodes[0].managerId, '上司プロフィールへのリンクを維持');
            Assert.isFalse(second.hasMore, '最終ページで継続を終了');
        }
    }

    /**
     * 構造の境界から続きだけを取得し、前ページの親へ接続
     */
    @IsTest
    static void continuesStructureFromVisibleBoundary() {
        System.runAs(testUser) {
            List<User> team = createTeam(1, null);
            OrgExplorerPageRequest request = managerRequest('MANAGER_STRUCTURE', null);
            OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerService().createPageCursor(request);
            cursor.lastId = team[0].Id;
            request.cursor = new OrgExplorerCursorCodec().encode(cursor);
            Test.startTest();
            OrgExplorerPageResponse next = OrgExplorerController.getPage(request);
            Test.stopTest();
            Map<Id, OrgExplorerPageResponse.Node> nodes = indexNodes(next.nodes);
            Assert.isFalse(nodes.containsKey(team[0].Id), '取得済みの上司を再取得しない');
            Assert.isTrue(nodes.containsKey(team[1].Id), '次の上司を欠落させない');
            Assert.areEqual('USER:' + team[0].Id, nodes.get(team[1].Id).parentKey, '別ページの可視な親との接続を保持');
        }
    }

    /**
     * 有効ユーザーだけの人数・候補と無効な親の接続境界を確認
     */
    @IsTest
    static void filtersInactiveReportsAndManagerParents() {
        System.runAs(testUser) {
            List<User> team = createTeam(2, null);
            team[1].IsActive = true;
            team[2].IsActive = true;
            update new List<User>{ team[1], team[2] };
            List<User> records = [SELECT Name FROM User WHERE Id = :team[1].Id];
            OrgExplorerSearchRequest search = new OrgExplorerSearchRequest();
            search.requestId = 'active-search';
            search.term = '  ' + records[0].Name + '  ';
            search.activityFilter = 'ACTIVE';
            OrgExplorerPageRequest request = managerRequest('MANAGER_STRUCTURE', null);
            Test.startTest();
            OrgExplorerPageResponse allUsers = OrgExplorerController.getPage(request);
            request.includeInactive = false;
            List<AggregateResult> activeGroups = selector.selectManagerGroups(request, null);
            OrgExplorerPageResponse activeUsers = OrgExplorerController.getPage(request);
            OrgExplorerPageResponse candidates = OrgExplorerController.searchManagers(search);
            Test.stopTest();
            Map<Id, OrgExplorerPageResponse.Node> nodes = indexNodes(activeUsers.nodes);
            Assert.areEqual(2, allUsers.memberCounts.get(team[1].Id), '全ユーザーでは無効の部下も集計');
            Assert.areEqual(1, activeUsers.memberCounts.get(team[1].Id), '有効な直属部下だけを集計');
            Assert.isFalse(nodes.containsKey(team[0].Id), '無効な上司を構造へ表示しない');
            Set<Id> groupedManagerIds = new Set<Id>();
            for (AggregateResult groupRecord : activeGroups) {
                groupedManagerIds.add((Id) groupRecord.get('managerId'));
            }
            Assert.isFalse(groupedManagerIds.contains(team[0].Id), '有効な部下がいても無効な上司で集計枠を消費しない');
            Assert.isTrue(groupedManagerIds.contains(team[1].Id), '有効な上司の集計は維持する');
            Assert.areEqual('', nodes.get(team[1].Id).parentKey, '無効な親を飛び越えて接続しない');
            Assert.areEqual(team[1].Id, candidates.nodes[0].recordId, '空白を除いた名前で有効な上司を検索');
        }
    }

    /**
     * 構造取得と直接所属一覧を独立して提供
     */
    @IsTest
    static void readsRoleStructureAndMembers() {
        System.runAs(testUser) {
            UserRole root = new UserRole(Name = '探索試験ルート');
            insert root;
            UserRole child = new UserRole(Name = '探索試験の子', ParentRoleId = root.Id);
            insert child;
            OrgExplorerPageRequest page = new OrgExplorerPageRequest();
            page.requestId = 'role-structure';
            page.mode = 'ROLE';
            page.scope = 'ROLE_STRUCTURE';
            page.parentId = root.Id;
            Test.startTest();
            OrgExplorerPageResponse structure = OrgExplorerController.getPage(page);
            page.scope = 'ROLE_MEMBERS';
            OrgExplorerPageResponse members = OrgExplorerController.getPage(page);
            Test.stopTest();
            Map<Id, OrgExplorerPageResponse.Node> nodes = new Map<Id, OrgExplorerPageResponse.Node>();
            for (OrgExplorerPageResponse.Node node : structure.nodes) {
                nodes.put(node.recordId, node);
                Assert.areEqual('ROLE', node.kind, '実ロールだけを返却');
            }
            Assert.areEqual('ROLE:' + root.Id, nodes.get(child.Id).parentKey, '可視な親へ接続');
            Assert.areEqual(0, members.nodes.size(), '所属のないロールは空一覧');
        }
    }

    /**
     * 起点なしで独立したルートと子ロールをまとめて取得
     */
    @IsTest
    static void loadsAllRoleTreesWithoutRoot() {
        System.runAs(testUser) {
            UserRole first = new UserRole(Name = '全体試験会社');
            UserRole second = new UserRole(Name = '全体試験別会社');
            insert new List<UserRole>{ first, second };
            UserRole child = new UserRole(Name = '全体試験部門', ParentRoleId = first.Id);
            insert child;
            OrgExplorerPageRequest request = structureRequest(null);
            Test.startTest();
            Integer beforeQueries = Limits.getQueries();
            OrgExplorerPageResponse response = OrgExplorerController.getPage(request);
            Integer queryCost = Limits.getQueries() - beforeQueries;
            Test.stopTest();
            Assert.areEqual(2, queryCost, '起点確認なしで構造と人数だけを照会');
            Map<Id, OrgExplorerPageResponse.Node> nodes = indexNodes(response.nodes);
            Assert.isTrue(nodes.containsKey(first.Id), '一つ目のルートを含む');
            Assert.isTrue(nodes.containsKey(second.Id), '別のルートも含む');
            Assert.areEqual('ROLE:' + first.Id, nodes.get(child.Id).parentKey, '子の階層関係を保つ');
        }

    }

    // 階層ごとの同じ参照確認を一つの索引化へ集約
    private static Map<Id, OrgExplorerPageResponse.Node> indexNodes(List<OrgExplorerPageResponse.Node> records) {
        Map<Id, OrgExplorerPageResponse.Node> nodes = new Map<Id, OrgExplorerPageResponse.Node>();
        for (OrgExplorerPageResponse.Node node : records) {
            nodes.put(node.recordId, node);
        }
        return nodes;
    }

    private static OrgExplorerPageResponse readNextPage(
        OrgExplorerPageRequest request,
        OrgExplorerPageResponse previous
    ) {
        request.paginationCursor = (Database.PaginationCursor) JSON.deserialize(
            JSON.serialize(previous.paginationCursor),
            Database.PaginationCursor.class
        );
        request.startIndex = previous.nextIndex;
        return OrgExplorerController.getPage(request);
    }

    private static void assertMemberPages(List<OrgExplorerPageResponse> pages, List<User> expected) {
        Set<Id> actual = new Set<Id>();
        List<Id> actualOrder = new List<Id>();
        for (OrgExplorerPageResponse page : pages) {
            Assert.isFalse(page.memberColumns.contains('roleName'), 'ロール側の一覧にはロール列を追加しない');
            Assert.areEqual(expected.size(), page.memberTotalCount, '一覧カーソルの総件数を全ページで提供');
            for (OrgExplorerPageResponse.Node node : page.nodes) {
                Assert.isFalse(actual.contains(node.recordId), 'ページ境界の重複なし');
                actual.add(node.recordId);
                actualOrder.add(node.recordId);
            }
        }
        Assert.areEqual(new Map<Id, User>(expected).keySet(), actual, '作成した全員を欠落なく取得');
        List<Id> expectedOrder = new List<Id>();
        for (User record : expected) {
            expectedOrder.add(record.Id);
        }
        Assert.areEqual(expectedOrder, actualOrder, '同名境界を含め氏名とIDの順序を維持');
        Assert.areEqual(
            pages[0].nodes[1].label,
            pages[1].nodes[0].label,
            '同名ユーザーがページ境界をまたぐケースを検証'
        );
        Assert.areEqual(
            new List<String>{ 'label', 'email', 'department', 'title', 'managerName', 'employeeNumber', 'profileName', 'isActive' },
            pages[0].memberColumns,
            '参照可能な列を定義順で提供'
        );
        Assert.areEqual(false, pages[0].nodes[0].isActive, '無効ユーザーの状態を一覧へ提供');
        Assert.areEqual('試験部署', pages[0].nodes[0].department, '部署を一覧へ提供');
        Assert.isTrue(String.isNotBlank(pages[0].nodes[0].managerName), '可視上司の名前を提供');
        Assert.areEqual(testUser.Id, pages[0].nodes[0].managerId, '可視確認済みの上司へリンクできる');
        Assert.isTrue(String.isNotBlank(pages[0].nodes[0].profileName), '可視プロファイルの名前を提供');
        Assert.areEqual(2, pages[0].nodes.size(), '先頭は指定件数だけ返す');
        Assert.areEqual(expected.size() - 2, pages[pages.size() - 1].nodes.size(), '最終ページは残りだけ返す');
        Assert.isFalse(pages[pages.size() - 1].hasMore, '末尾で次ページを公開しない');
    }

    private static List<User> createInactiveUsers(Integer count) {
        List<User> users = new List<User>();
        for (Integer index = 0; index < count; index++) {
            User record = createUser('探索試験' + index);
            record.IsActive = false;
            record.ManagerId = testUser.Id;
            users.add(record);
        }
        return users;
    }

    private static Id fakeId(Schema.SObjectType objectType) {
        return Id.valueOf(objectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
    }

    private static OrgExplorerPageRequest managerRequest(String scope, Id parentId) {
        OrgExplorerPageRequest request = new OrgExplorerPageRequest();
        request.requestId = 'manager-page';
        request.mode = 'MANAGER';
        request.scope = scope;
        request.parentId = parentId;
        request.includeInactive = true;
        return request;
    }

    // 検証に必要な部下数と所属ロールだけを作成対象にする
    private static List<User> createTeam(Integer memberCount, UserRole role) {
        User root = createUser('上司検証A');
        root.IsActive = false;
        root.ManagerId = null;
        root.UserRoleId = null;
        insert root;
        User manager = createUser('上司検証B');
        manager.IsActive = false;
        manager.ManagerId = root.Id;
        manager.Title = '試験課長';
        manager.Department = '試験営業部';
        manager.UserRoleId = role?.Id;
        insert manager;
        List<User> members = new List<User>();
        for (Integer index = 0; index < memberCount; index++) {
            User member = createUser('直属検証' + index);
            member.IsActive = false;
            member.ManagerId = manager.Id;
            members.add(member);
        }
        insert members;
        List<User> team = new List<User>{ root, manager };
        team.addAll(members);
        return team;
    }

    private static OrgExplorerPageRequest structureRequest(Id rootId) {
        OrgExplorerPageRequest request = new OrgExplorerPageRequest();
        request.requestId = 'structure-test';
        request.mode = 'ROLE';
        request.scope = 'ROLE_STRUCTURE';
        request.parentId = rootId;
        request.includeInactive = true;
        return request;
    }

    /**
     * 構造要求へユーザー一覧の途中位置を流用しない
     */
    @IsTest
    static void rejectsMemberPositionOnStructureRequest() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = managerRequest('MANAGER_STRUCTURE', null);
            request.startIndex = 5;
            Test.startTest();
            Assert.areEqual('ページの有効期限または条件が変わりました。再読込してください。', getFailureMessage('PAGE', request), '固定の公開例外で要求を拒否');
            Integer queries = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual(0, queries, '不正な位置から構造を照会しない');
        }
    }

    /**
     * 可視な親でも負の取得位置から部下を列挙しない
     */
    @IsTest
    static void rejectsNegativePositionForVisibleManager() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = managerRequest('MANAGER_MEMBERS', testUser.Id);
            request.startIndex = -1;
            Test.startTest();
            Assert.areEqual('ページの有効期限または条件が変わりました。再読込してください。', getFailureMessage('PAGE', request), '固定の公開例外で要求を拒否');
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

    // 成功応答を返さず、安全な公開例外で通知することを確認
    private static String getFailureMessage(String action, Object request) {
        try {
            switch on action {
                when 'CAPABILITIES' { OrgExplorerController.getCapabilities((String) request); }
                when 'ROLES' { OrgExplorerController.searchRoles((OrgExplorerSearchRequest) request); }
                when 'MANAGERS' { OrgExplorerController.searchManagers((OrgExplorerSearchRequest) request); }
                when else { OrgExplorerController.getPage((OrgExplorerPageRequest) request); }
            }
            Assert.fail('不正な要求は公開例外で拒否する');
        } catch (AuraHandledException error) {
            return error.getMessage();
        }
        return null;
    }
}
