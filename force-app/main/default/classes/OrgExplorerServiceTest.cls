/**
 * ロール・上司構造と候補・人数・公開エラーの変換
 */
@IsTest
private with sharing class OrgExplorerServiceTest {

    private static OrgExplorerService service = new OrgExplorerService();
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 任意項目と関連ロールの参照不足でカード情報を公開しない
     */
    @IsTest
    static void hidesInaccessibleCardFields() {
        System.runAs(testUser) {
            Id roleId = Id.valueOf(
                UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'
            );
            User manager = new User(
                Id = testUser.Id,
                IsActive = false,
                UserRoleId = roleId,
                Title = '課長',
                Department = '試験部署'
            );
            List<User> records = new List<User>{ manager };
            List<UserRole> roles = new List<UserRole>{ new UserRole(Id = roleId, Name = '試験ロール') };
            OrgExplorerService.ManagerPageData wrapper = new OrgExplorerService.ManagerPageData(
                new List<AggregateResult>(),
                records
            );
            wrapper.roles = roles;
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.titleEnabled = false;
            access.departmentEnabled = false;
            access.membershipEnabled = false;
            Test.startTest();
            OrgExplorerPageResponse hidden = service.createManagerStructure(
                wrapper,
                managerRequest('MANAGER_STRUCTURE', null),
                access
            );
            access.membershipEnabled = true;
            access.rolesEnabled = true;
            wrapper.roles.clear();
            OrgExplorerPageResponse missingRole = service.createManagerStructure(
                wrapper,
                managerRequest('MANAGER_STRUCTURE', null),
                access
            );
            Test.stopTest();
            Assert.areEqual('', hidden.nodes[0].title, '役職を非公開にする');
            Assert.areEqual('UNAVAILABLE', hidden.nodes[0].titleState, '役職列を非表示にする');
            Assert.areEqual('', hidden.nodes[0].department, '部署を非公開にする');
            Assert.areEqual('UNAVAILABLE', hidden.nodes[0].departmentState, '部署列を非表示にする');
            Assert.areEqual(
                '',
                hidden.cardRoles.get(manager.Id).get('name'),
                '所属項目を参照できなければロール名を非公開'
            );
            Assert.areEqual('UNAVAILABLE', hidden.cardRoles.get(manager.Id).get('state'), '所属項目を非表示にする');
            Assert.areEqual('', missingRole.cardRoles.get(manager.Id).get('name'), '非可視の関連ロール名を非公開');
            Assert.areEqual(
                'UNAVAILABLE',
                missingRole.cardRoles.get(manager.Id).get('state'),
                '非可視の関連先を未登録と区別'
            );
        }
    }

    /**
     * 内部失敗を固定の公開エラーへ変換
     */
    @IsTest
    static void createsSafeServerError() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerError error = service.createError('SERVER_ERROR');
            Test.stopTest();
            Assert.areEqual('SERVER_ERROR', error.code, '内部失敗を公開コードへ限定');
            Assert.areEqual(
                '取得できませんでした。時間をおいて再試行してください。',
                error.message,
                '固定文言だけを返す'
            );
        }
    }

    /**
     * 参照拒否を内部の照会情報なしで通知
     */
    @IsTest
    static void createsSafeAccessError() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerError error = service.createError('ACCESS_DENIED');
            Test.stopTest();
            Assert.areEqual('ACCESS_DENIED', error.code, '参照拒否を公開コードへ限定');
            Assert.areEqual(
                '必要な参照権限がありません。管理者へ確認してください。',
                error.message,
                '固定文言だけを返す'
            );
        }
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

    /**
     * 非可視な上司を起点にせず、未指定の構造要求だけを許可
     */
    @IsTest
    static void checksManagerParentVisibility() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = managerRequest('MANAGER_MEMBERS', UserInfo.getUserId());
            Test.startTest();
            Boolean hidden = service.canReadManagerParent(request, new List<User>());
            Boolean unspecified = service.canReadManagerParent(
                managerRequest('MANAGER_STRUCTURE', null),
                new List<User>()
            );
            Test.stopTest();
            Assert.isFalse(hidden, '非可視の上司を起点にしない');
            Assert.isTrue(unspecified, '起点未指定を許可');
        }
    }

    /**
     * 先読みがある場合は最後に公開した可視上司から継続
     */
    @IsTest
    static void continuesManagerStructureAbovePageSize() {
        System.runAs(testUser) {
            OrgExplorerService.ManagerPageData wrapper = createManagerPage(1);
            OrgExplorerPageRequest request = managerRequest('MANAGER_STRUCTURE', null);
            Test.startTest();
            OrgExplorerPageResponse response = new OrgExplorerService(1, 50)
                .createManagerStructure(wrapper, request, new OrgExplorerAccessPolicy());
            OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerCursorCodec().decode(response.nextCursor);
            Test.stopTest();
            Assert.isTrue(response.ok, '可視な継続境界のある構造を返す');
            Assert.isTrue(response.hasMore, '境界を超えた集計の続きを通知');
            Assert.areEqual(1, response.nodes.size(), '可視確認済みの上司だけを公開');
            Assert.areEqual(1, response.roleMemberCounts.size(), '非可視上司の人数を公開しない');
            Assert.areEqual(1, response.roleMemberCounts.get(wrapper.records[0].Id), '直属部下数を対応');
            Assert.areEqual(wrapper.records[0].Id, cursor.lastId, '先読みでなく公開した上司を継続境界にする');
            Assert.areEqual(testUser.Id, cursor.viewerId, '現在の閲覧者へ継続値を固定');
            Assert.areEqual(request.scope, cursor.scope, '同じ構造用途の継続値を発行');
        }
    }

    /**
     * 上限と同じ件数では継続値を発行しない
     */
    @IsTest
    static void finishesManagerStructureAtPageSize() {
        System.runAs(testUser) {
            OrgExplorerService.ManagerPageData wrapper = createManagerPage(2);
            Test.startTest();
            OrgExplorerPageResponse response = new OrgExplorerService(2, 50)
                .createManagerStructure(
                    wrapper,
                    managerRequest('MANAGER_STRUCTURE', null),
                    new OrgExplorerAccessPolicy()
                );
            Test.stopTest();
            Assert.isTrue(response.ok, '上限と同じ件数でも構造取得が成功');
            Assert.areEqual(2, response.nodes.size(), '確認済みの上司をすべて公開');
            Assert.isFalse(response.hasMore, '上限ちょうどでは次ページを要求しない');
            Assert.isTrue(String.isBlank(response.nextCursor), '最終ページに継続値を発行しない');
        }
    }

    /**
     * 可視な境界がない未完了の集計でIDを公開しない
     */
    @IsTest
    static void rejectsInvisibleManagerStructureAbovePageSize() {
        System.runAs(testUser) {
            OrgExplorerService.ManagerPageData wrapper = createManagerPage(0);
            Test.startTest();
            OrgExplorerPageResponse response = new OrgExplorerService(1, 50)
                .createManagerStructure(
                    wrapper,
                    managerRequest('MANAGER_STRUCTURE', null),
                    new OrgExplorerAccessPolicy()
                );
            Test.stopTest();
            Assert.isFalse(response.ok, '未完了の集計を空の成功応答にしない');
            Assert.areEqual('ACCESS_DENIED', response.error.code, '可視な境界なしを安全に拒否');
            Assert.isTrue(response.nodes.isEmpty(), '非可視上司を公開しない');
            Assert.isTrue(response.roleMemberCounts.isEmpty(), '非可視上司の人数を公開しない');
            Assert.isFalse(response.hasMore, '非可視IDからの継続を案内しない');
            Assert.isTrue(String.isBlank(response.nextCursor), '非可視IDを継続値へ含めない');
        }
    }

    // 新規ユーザー2件から、上司ごとに異なる実際の集計結果を作成
    private static OrgExplorerService.ManagerPageData createManagerPage(Integer visibleCount) {
        User manager = TestDataFactory.createUser('境界検証上司', TestDataFactory.SaveMode.DO_NOT_INSERT);
        manager.IsActive = false;
        manager.ManagerId = testUser.Id;
        insert manager;
        User member = TestDataFactory.createUser('境界検証部下', TestDataFactory.SaveMode.DO_NOT_INSERT);
        member.IsActive = false;
        member.ManagerId = manager.Id;
        insert member;
        Set<Id> reportIds = new Set<Id>{ manager.Id, member.Id };
        List<AggregateResult> groups = [
            SELECT ManagerId managerId, COUNT(Id) memberCount
            FROM User
            WHERE Id IN :reportIds
            GROUP BY ManagerId
            ORDER BY ManagerId
        ];
        Set<Id> visibleIds = service.getManagerGroupIds(groups, visibleCount);
        List<User> records = [
            SELECT Id, Name, IsActive, ManagerId, UserRoleId, Title, Department
            FROM User
            WHERE Id IN :visibleIds
            ORDER BY Id
        ];
        Assert.areEqual(2, groups.size(), '新規二件から二上司の集計を作成');
        return new OrgExplorerService.ManagerPageData(groups, records);
    }

    /**
     * 未保存のロールと未定義エラーを直接変換
     */
    @IsTest
    static void createsRoleNodeAndNormalizesError() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Id = (Id) (UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'), Name = '試験部門');
            Test.startTest();
            OrgExplorerPageResponse.Node node = service.createRoleNode(role);
            OrgExplorerError error = service.createError('UNKNOWN');
            Test.stopTest();
            Assert.areEqual('ROLE:' + role.Id, node.key, 'ロールの種別とIDを維持');
            Assert.areEqual(role.Name, node.label, 'ロール名を返す');
            Assert.areEqual('SERVER_ERROR', error.code, '未定義コードを安全な失敗へ統一する');
        }
    }

    /**
     * 未保存の一件から上司候補を変換
     */
    @IsTest
    static void createsManagerCandidateWithoutDml() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerPageResponse result = service.createManagerSearchResults(
                new OrgExplorerService.ManagerPageData(new List<AggregateResult>(), new List<User>{ new User(Id = testUser.Id, LastName = '候補') }),
                new OrgExplorerAccessPolicy()
            );
            Test.stopTest();
            Assert.areEqual(testUser.Id, result.nodes[0].recordId, '候補を公開ノードへ変換');
            Assert.isFalse(result.hasMore, '先読みなしでは追加候補を通知しない');
        }
    }

    /**
     * 少量データによる先読みの除外と未確認親・継続境界の検証
     */
    @IsTest
    static void boundsStructurePageAndVerifiesParents() {
        System.runAs(testUser) {
            List<UserRole> records = syntheticRoles(4);
            Id outsideId = roleId(9);
            records[0].ParentRoleId = outsideId;
            records[1].ParentRoleId = records[0].Id;
            OrgExplorerPageRequest request = structureRequest(outsideId);
            OrgExplorerService limitedService = new OrgExplorerService(3, 50);
            Test.startTest();
            Set<Id> parentIds = limitedService.getUnloadedRoleParentIds(records);
            OrgExplorerPageResponse response = limitedService.createRolePage(records, new List<UserRole>(), request);
            OrgExplorerPageResponse visible = limitedService.createRolePage(
                records,
                new List<UserRole>{ new UserRole(Id = outsideId) },
                request
            );
            OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerCursorCodec().decode(response.nextCursor);
            Set<Id> countIds = limitedService.getMemberCountRoleIds(response, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual(new Set<Id>{ outsideId }, parentIds, 'ページ内の親は再照会しない');
            Assert.areEqual(3, response.nodes.size(), '先読み一件を含めない');
            Assert.isTrue(response.hasMore, '指定上限を超えた構造の続きを通知');
            Assert.areEqual('', response.nodes[0].parentKey, '非可視の親を公開しない');
            Assert.areEqual('ROLE:' + outsideId, visible.nodes[0].parentKey, '確認済みの親だけ接続');
            Assert.areEqual('ROLE:' + records[0].Id, response.nodes[1].parentKey, 'ページ内の親は接続');
            Assert.areEqual(records[2].Id, cursor.lastId, '先読み前の最後を次の境界にする');
            Assert.areEqual(3, countIds.size(), '表示ページのロールだけを集計対象にする');
            Assert.isFalse(countIds.contains(records[3].Id), '先読み行を人数集計へ含めない');
            Assert.isFalse(countIds.contains(outsideId), '別ページの起点はその取得時に集計');
        }
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

    private static List<UserRole> syntheticRoles(Integer count) {
        List<UserRole> records = new List<UserRole>();
        for (Integer index = 1; index <= count; index++) {
            records.add(new UserRole(Id = roleId(index), Name = '構造部門' + index));
        }
        return records;
    }

    private static Id roleId(Integer value) {
        return Id.valueOf('00E' + String.valueOf(value).leftPad(12, '0'));
    }

    /**
     * ロール構造を読めても所属参照なしでは人数を照会させない
     */
    @IsTest
    static void excludesMemberCountTargetsWithoutMembershipAccess() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.membershipEnabled = false;
            OrgExplorerPageResponse response = new OrgExplorerPageResponse();
            OrgExplorerPageResponse.Node node = new OrgExplorerPageResponse.Node();
            node.recordId = roleId(1);
            response.nodes.add(node);
            Test.startTest();
            Set<Id> ids = service.getMemberCountRoleIds(response, access);
            Test.stopTest();
            Assert.isTrue(ids.isEmpty(), '所属権限なしでは人数を集計しない');
        }
    }

    /**
     * 可視な集計対象だけをゼロ件で補完し、未取得のロールを追加しない
     */
    @IsTest
    static void initializesCountsOnlyForVisibleRoles() {
        System.runAs(testUser) {
            Id visibleId = roleId(1);
            Id hiddenId = roleId(2);
            Test.startTest();
            Map<Id, Integer> counts = service.createRoleMemberCounts(
                new Set<Id>{ visibleId },
                new List<AggregateResult>()
            );
            Test.stopTest();
            Assert.areEqual(0, counts.get(visibleId), '集計済みのゼロ件を明示');
            Assert.isFalse(counts.containsKey(hiddenId), '未取得の人数をゼロで補わない');
        }
    }

    /**
     * 上限ちょうどの構造を最終ページとして返す
     */
    @IsTest
    static void finishesStructureAtConfiguredLimit() {
        System.runAs(testUser) {
            OrgExplorerService limitedService = new OrgExplorerService(3, 50);
            List<UserRole> records = syntheticRoles(3);
            Test.startTest();
            OrgExplorerPageResponse response = limitedService.createRolePage(
                records,
                new List<UserRole>(),
                structureRequest(null)
            );
            Test.stopTest();
            Assert.areEqual(3, response.nodes.size(), '上限ちょうどのロールをすべて返す');
            Assert.isFalse(response.hasMore, '先読みがなければ次ページを要求しない');
            Assert.isTrue(String.isBlank(response.nextCursor), '終端で継続値を発行しない');
        }
    }

    /**
     * 一件の集計結果を対象ロールへ対応
     */
    @IsTest
    static void mapsSingleMemberCount() {
        System.runAs(testUser) {
            UserRole role = new UserRole(Name = '集計対象');
            insert role;
            testUser.UserRoleId = role.Id;
            update testUser;
            List<AggregateResult> groups = [SELECT UserRoleId roleId, COUNT(Id) memberCount FROM User WHERE Id = :testUser.Id GROUP BY UserRoleId];
            Test.startTest();
            Map<Id, Integer> counts = service.createRoleMemberCounts(new Set<Id>{ role.Id }, groups);
            Test.stopTest();
            Assert.areEqual(1, counts.get(role.Id), '直接所属の集計値を反映');
        }
    }

    /**
     * 大量候補は上限を通知し、全件を画面へ返さない
     */
    @IsTest
    static void limitsRoleLookupCandidates() {
        System.runAs(testUser) {
            OrgExplorerService limitedService = new OrgExplorerService(1000, 1);
            List<UserRole> roles = new List<UserRole>{
                new UserRole(Name = '先頭候補'),
                new UserRole(Name = '先読み候補')
            };
            Test.startTest();
            OrgExplorerPageResponse response = limitedService.createRoleSearchResults(roles);
            Test.stopTest();
            Assert.isTrue(response.ok, '可視ロールの候補照会が成功');
            Assert.areEqual(1, response.nodes.size(), '指定した候補上限まで返す');
            Assert.areEqual(roles[0].Name, response.nodes[0].label, '先読み候補を表示へ混ぜない');
            Assert.isTrue(response.hasMore, 'さらに名前を絞る必要があると通知');
        }
    }

    /**
     * 上限ちょうどの候補では追加の絞り込みを要求しない
     */
    @IsTest
    static void finishesRoleLookupAtConfiguredLimit() {
        System.runAs(testUser) {
            OrgExplorerService limitedService = new OrgExplorerService(1000, 1);
            List<UserRole> roles = new List<UserRole>{ new UserRole(Name = '候補') };
            Test.startTest();
            OrgExplorerPageResponse response = limitedService.createRoleSearchResults(roles);
            Test.stopTest();
            Assert.isTrue(response.ok, '上限ちょうどの候補取得が成功');
            Assert.areEqual(1, response.nodes.size(), 'すべての候補を返す');
            Assert.isFalse(response.hasMore, '先読みがなければ追加の絞り込みを要求しない');
        }
    }

}