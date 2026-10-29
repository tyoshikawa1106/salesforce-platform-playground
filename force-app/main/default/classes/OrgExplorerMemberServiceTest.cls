/**
 * ユーザーの公開項目・関連先・標準カーソルの一覧変換
 */
@IsTest
private with sharing class OrgExplorerMemberServiceTest {

    private static OrgExplorerMemberService service = new OrgExplorerMemberService();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 項目の未登録と参照不可を混同しない
     */
    @IsTest
    static void distinguishesEmptyAndUnavailableFields() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            User record = new User(Id = testUser.Id, IsActive = true, Title = '非公開役職', Department = '非公開部署');
            access.titleEnabled = false;
            access.departmentEnabled = false;
            access.emailEnabled = false;
            Test.startTest();
            OrgExplorerPageResponse.Node node = service.createUserNode(record, access);
            List<String> fields = access.getUserFields('MANAGER_MEMBERS');
            access.titleEnabled = true;
            OrgExplorerPageResponse.Node empty = service.createUserNode(new User(Id = testUser.Id), access);
            Test.stopTest();
            Assert.areEqual('UNAVAILABLE', node.titleState, '非参照の役職を明示');
            Assert.areEqual('', node.title, '非参照の値をコピーしない');
            Assert.areEqual('UNAVAILABLE', node.departmentState, '部署の非参照を明示');
            Assert.isFalse(fields.contains('Email'), '非参照項目を照会から除外');
            Assert.areEqual('EMPTY', empty.titleState, '参照可能な未登録項目を区別');
        }
    }

    /**
     * 所属一覧の項目権限を列と返却値の両方へ適用
     */
    @IsTest
    static void omitsUnreadableMemberFields() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.emailEnabled = false;
            access.employeeNumberEnabled = false;
            access.departmentEnabled = false;
            access.titleEnabled = false;
            access.managerEnabled = false;
            access.profileEnabled = false;
            access.membershipEnabled = false;
            User record = new User(
                Id = testUser.Id,
                Email = 'member@example.invalid',
                EmployeeNumber = 'DEMO-000001',
                Department = '非公開部署',
                Title = '非公開役職'
            );
            Test.startTest();
            OrgExplorerPageResponse response = service.createMemberPage(
                new OrgExplorerMemberService.MemberPageData(
                    new List<User>{ record },
                    new List<User>(),
                    new List<Profile>()
                ),
                memberRequest(),
                access
            );
            List<String> fields = access.getUserFields('MANAGER_MEMBERS');
            Test.stopTest();
            Assert.areEqual(
                new List<String>{ 'label', 'isActive' },
                response.memberColumns,
                '非参照項目の列を返さない'
            );
            Assert.areEqual(
                new Set<String>{ 'label', 'isActive' },
                response.memberColumnLabels.keySet(),
                '非参照項目のラベルを返さない'
            );
            Assert.areEqual(
                User.Name.getDescribe().getLabel(),
                response.memberColumnLabels.get('label'),
                '氏名の項目ラベルを返す'
            );
            OrgExplorerPageResponse.Node node = response.nodes[0];
            Assert.areEqual('', node.email, 'メールを公開しない');
            Assert.areEqual('', node.employeeNumber, '非参照の従業員番号を公開しない');
            Assert.areEqual('', node.managerName, '上司を公開しない');
            Assert.isNull(node.managerId, '非参照の上司IDも公開しない');
            Assert.areEqual('', node.profileName, 'プロファイルを公開しない');
            Assert.isFalse(fields.contains('Email'), '非参照メールを取得しない');
            Assert.isFalse(fields.contains('EmployeeNumber'), '非参照の従業員番号を取得しない');
            Assert.isFalse(fields.contains('ProfileId'), '非参照の関連IDを取得しない');
        }
    }

    /**
     * ゼロ件でも項目定義のラベルを追加照会なしで提供
     */
    @IsTest
    static void returnsMemberFieldLabelsWithoutQueries() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.usersEnabled = true;
            access.emailEnabled = true;
            access.employeeNumberEnabled = true;
            access.departmentEnabled = true;
            access.titleEnabled = true;
            access.managerEnabled = true;
            access.profileEnabled = true;
            access.membershipEnabled = true;
            access.rolesEnabled = true;
            Test.startTest();
            Integer queriesBefore = Limits.getQueries();
            OrgExplorerPageResponse response = service.createMemberPage(
                new OrgExplorerMemberService.MemberPageData(new List<User>(), new List<User>(), new List<Profile>()),
                memberRequest(),
                access
            );
            Integer addedQueries = Limits.getQueries() - queriesBefore;
            Test.stopTest();
            Assert.areEqual(0, addedQueries, '項目情報取得にSOQLを実行しない');
            Assert.areEqual(
                new Map<String, String>{
                    'label' => User.Name.getDescribe().getLabel(),
                    'email' => User.Email.getDescribe().getLabel(),
                    'department' => User.Department.getDescribe().getLabel(),
                    'title' => User.Title.getDescribe().getLabel(),
                    'employeeNumber' => User.EmployeeNumber.getDescribe().getLabel(),
                    'isActive' => User.IsActive.getDescribe().getLabel()
                },
                response.memberColumnLabels,
                '固定見出し以外の列をUser項目のラベルへ対応させる'
            );
            Assert.isTrue(response.nodes.isEmpty(), 'ゼロ件の応答でも列ラベルを提供する');
        }
    }

    /**
     * マネージャーのリンクにも関連先の可視性を適用
     */
    @IsTest
    static void exposesOnlyVisibleMemberManager() {

        System.runAs(testUser) {
            List<User> managers = [SELECT Id, Name FROM User WHERE Id = :testUser.Id];
            Assert.areEqual(1, managers.size(), '上司の参照前提を確認');
            User manager = managers[0];
            User member = new User(Id = testUser.Id, ManagerId = manager.Id);
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.emailEnabled = true;
            access.profileEnabled = true;
            access.managerEnabled = true;
            access.titleEnabled = true;
            String memberBefore = JSON.serialize(member);
            Test.startTest();
            OrgExplorerPageResponse response = service.createMemberPage(
                new OrgExplorerMemberService.MemberPageData(
                    new List<User>{ member },
                    new List<User>{ manager },
                    new List<Profile>()
                ),
                memberRequest(),
                access
            );
            OrgExplorerPageResponse original = response;
            Id visibleId = response.nodes[0].managerId;
            String visibleName = response.nodes[0].managerName;
            response = service.createMemberPage(
                new OrgExplorerMemberService.MemberPageData(
                    new List<User>{ member },
                    new List<User>(),
                    new List<Profile>()
                ),
                memberRequest(),
                access
            );
            Test.stopTest();
            Assert.areEqual(memberBefore, JSON.serialize(member), '応答生成で入力レコードを変更しない');
            Assert.areEqual(manager.Name, original.nodes[0].managerName, '後続の呼び出しで前の上司名を変更しない');
            Assert.areEqual(manager.Id, visibleId, '可視な関連先のIDだけをリンク対象へ返す');
            Assert.areEqual(manager.Name, visibleName, '氏名とリンク先を同じ関連先に揃える');
            Assert.isNull(response.nodes[0].managerId, '不可視な関連先IDを返さない');
            Assert.areEqual('', response.nodes[0].managerName, '不可視な関連先名を空欄にする');
            Assert.areEqual('', response.nodes[0].email, '未登録のメールを空欄にする');
            Assert.areEqual('', response.nodes[0].profileName, '未取得のプロファイル名を空欄にする');
        }
    }

    /**
     * 一覧変換の上限を少量の未保存レコードで検証
     */
    @IsTest
    static void limitsMemberNodesToRequestedPageSize() {

        System.runAs(testUser) {
            OrgExplorerMemberService.MemberPageData wrapper = new OrgExplorerMemberService.MemberPageData(
                new List<User>{ new User(Id = testUser.Id, LastName = '先頭'), new User(LastName = '先読み') },
                new List<User>(),
                new List<Profile>()
            );
            OrgExplorerPageRequest request = memberRequest();
            request.mode = 'ROLE';
            request.scope = 'ROLE_MEMBERS';
            request.parentId = (Id) (UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
            request.pageSize = 1;
            Test.startTest();
            OrgExplorerPageResponse response = service.createMemberPage(wrapper, request, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual(1, response.nodes.size(), '指定されたページ件数だけを返す');
            Assert.areEqual(testUser.Id, response.nodes[0].recordId, '入力の先頭を維持する');
        }
    }

    /** 参照できない関連先と空カーソルを除外 */
    @IsTest
    static void skipsUnreadableRelationsAndEmptyCursor() {

        System.runAs(testUser) {
            List<User> records = [SELECT Id FROM User WHERE Id = :testUser.Id];
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.managerEnabled = false;
            access.membershipEnabled = false;
            access.profileEnabled = false;
            Test.startTest();
            Set<Id> managers = service.getManagerIds(records, access);
            Set<Id> roles = service.getRoleIds(records, access, 'MANAGER_MEMBERS');
            Set<Id> profiles = service.getProfileIds(records, access);
            Set<Id> members = service.getMemberIds(null);
            List<User> ordered = service.orderMemberRecords(null, records);
            Test.stopTest();
            Assert.isTrue(managers.isEmpty(), '非参照の上司項目へアクセスしない');
            Assert.isTrue(roles.isEmpty(), '非参照のロール項目へアクセスしない');
            Assert.isTrue(profiles.isEmpty(), '非参照のプロファイル項目へアクセスしない');
            Assert.isTrue(members.isEmpty(), '空カーソルを全件取得へ変換しない');
            Assert.isTrue(ordered.isEmpty(), '空カーソルへ取得済みユーザーを補完しない');
        }
    }

    /** 可視な上司メンバーのロール名だけを公開 */
    @IsTest
    static void exposesRoleNamesOnlyForVisibleManagerMembers() {

        System.runAs(testUser) {
            Id targetId = Id.valueOf(UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
            User member = new User(Id = testUser.Id, UserRoleId = targetId);
            OrgExplorerMemberService.MemberPageData data = new OrgExplorerMemberService.MemberPageData(
                new List<User>{ member }, new List<User>(), new List<Profile>()
            );
            data.roles.put(targetId, new UserRole(Id = targetId, Name = '営業担当'));
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.membershipEnabled = true;
            access.rolesEnabled = true;
            OrgExplorerPageRequest request = memberRequest();
            Test.startTest();
            OrgExplorerPageResponse visible = service.createMemberPage(data, request, access);
            data.roles.clear();
            OrgExplorerPageResponse hidden = service.createMemberPage(data, request, access);
            member.UserRoleId = null;
            OrgExplorerPageResponse unassigned = service.createMemberPage(data, request, access);
            data.roles.put(targetId, new UserRole(Id = targetId, Name = '非公開ロール'));
            member.UserRoleId = targetId;
            access.membershipEnabled = false;
            OrgExplorerPageResponse denied = service.createMemberPage(data, request, access);
            access.membershipEnabled = true;
            request.mode = 'ROLE';
            request.scope = 'ROLE_MEMBERS';
            OrgExplorerPageResponse roleMembers = service.createMemberPage(data, request, access);
            Test.stopTest();
            Assert.areEqual('営業担当', visible.nodes[0].roleName, '可視ロールの名前だけを一覧へ返す');
            Assert.areEqual('', hidden.nodes[0].roleName, '参照できない関連先の名前を公開しない');
            Assert.areEqual('', unassigned.nodes[0].roleName, 'ロール未設定は空欄にする');
            Assert.areEqual('', denied.nodes[0].roleName, '項目参照権限のないロール名を返さない');
            Assert.isFalse(denied.memberColumns.contains('roleName'), '権限のないロール列も返さない');
            Assert.areEqual('', roleMembers.nodes[0].roleName, 'ロール側のメンバー一覧へ新しい列を混入させない');
            Assert.isFalse(roleMembers.memberColumns.contains('roleName'), 'ロール側の一覧列を維持する');
        }
    }

    /**
     * 両モードの一覧へ従業員番号を文字列で返し未登録は空欄にする
     */
    @IsTest
    static void exposesEmployeeNumbersForBothMemberLists() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.employeeNumberEnabled = true;
            OrgExplorerMemberService.MemberPageData data = new OrgExplorerMemberService.MemberPageData(
                new List<User>{ new User(EmployeeNumber = '000007'), new User() },
                new List<User>(),
                new List<Profile>()
            );
            Test.startTest();
            for (String mode : new List<String>{ 'ROLE', 'MANAGER' }) {
                OrgExplorerPageRequest request = memberRequest();
                request.mode = mode;
                request.scope = mode + '_MEMBERS';
                OrgExplorerPageResponse page = service.createMemberPage(data, request, access);
                Assert.areEqual('000007', page.nodes[0].employeeNumber, '先頭のゼロを保持して従業員番号を返す');
                Assert.areEqual('', page.nodes[1].employeeNumber, '未登録の従業員番号は空欄にする');
                Assert.isTrue(page.memberColumns.contains('employeeNumber'), '両モードへ従業員番号の列を返す');
            }
            Test.stopTest();
        }
    }

    private static OrgExplorerPageRequest memberRequest() {
        OrgExplorerPageRequest request = new OrgExplorerPageRequest();
        request.requestId = 'member-fields';
        request.mode = 'MANAGER';
        request.scope = 'MANAGER_MEMBERS';
        request.parentId = testUser.Id;
        return request;
    }

    /**
     * 標準カーソルの一件から関連ID・順序・一覧を直接確認
     */
    @IsTest
    static void buildsMemberPageFromSingleCursorRecord() {

        System.runAs(testUser) {
            List<User> records = [SELECT Id, Name, IsActive, Email, Title, Department, EmployeeNumber, ProfileId FROM User WHERE Id = :testUser.Id];
            User member = records[0];
            member.ManagerId = testUser.Id;
            member.UserRoleId = (Id) (UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
            List<Profile> profiles = [SELECT Id, Name FROM Profile WHERE Id = :member.ProfileId];
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            Database.PaginationCursor cursor = Database.getPaginationCursorWithBinds(
                'SELECT Id FROM User WHERE Id = :id', new Map<String, Object>{ 'id' => testUser.Id }, AccessLevel.USER_MODE
            );
            Database.CursorFetchResult fetched = cursor.fetchPage(0, 1);
            OrgExplorerMemberService.MemberPageData data = new OrgExplorerMemberService.MemberPageData(records, records, profiles);
            data.paginationCursor = cursor;
            data.fetched = fetched;
            Test.startTest();
            Set<Id> ids = service.getMemberIds(fetched);
            List<User> ordered = service.orderMemberRecords(fetched, records);
            OrgExplorerPageResponse page = service.createMemberPage(data, memberRequest(), access);
            Set<Id> managers = service.getManagerIds(records, access);
            Set<Id> roles = service.getRoleIds(records, access, 'MANAGER_MEMBERS');
            Set<Id> profileIds = service.getProfileIds(records, access);
            List<User> missing = service.orderMemberRecords(fetched, new List<User>());
            Test.stopTest();
            Assert.areEqual(new Set<Id>{ testUser.Id }, ids, 'カーソルのIDを抽出');
            Assert.areEqual(testUser.Id, ordered[0].Id, '標準の順序を保持');
            Assert.areEqual(1, page.memberTotalCount, '標準カーソルの件数を返す');
            Assert.areEqual(profiles[0].Name, page.nodes[0].profileName, '可視プロファイルを返す');
            Assert.areEqual(new Set<Id>{ testUser.Id }, managers, '関連上司を抽出');
            Assert.areEqual(new Set<Id>{ member.UserRoleId }, roles, '関連ロールを抽出');
            Assert.areEqual(new Set<Id>{ member.ProfileId }, profileIds, '関連プロファイルを抽出');
            Assert.isTrue(missing.isEmpty(), '再取得できないユーザーは公開しない');
        }
    }
}
