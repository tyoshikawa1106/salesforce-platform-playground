/**
 * 組織探索のPageResponseの初期状態
 */
@IsTest
private with sharing class OrgExplorerPageResponseTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 未設定のページ応答を初期化 */
    @IsTest
    static void initializesUnassignedState() {

        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerPageResponse value = new OrgExplorerPageResponse();
            Test.stopTest();
            Assert.areEqual(false, value.hasMore, 'hasMoreの初期契約を維持');
            Assert.isNull(value.paginationCursor, 'paginationCursorを未設定として扱う');
            Assert.isNull(value.memberTotalCount, 'memberTotalCountを未設定として扱う');
            Assert.areEqual(0, value.nextIndex, 'nextIndexの初期契約を維持');
            Assert.areEqual('', value.memberNotice, 'memberNoticeの初期契約を維持');
        }
    }

    /** 応答間でコレクションを共有しない */
    @IsTest
    static void keepsCollectionsIndependentBetweenResponses() {

        System.runAs(testUser) {
            OrgExplorerPageResponse first = new OrgExplorerPageResponse();
            Test.startTest();
            first.nodes.add(new OrgExplorerPageResponse.Node());
            first.memberColumns.add('label');
            first.memberColumnLabels.put('label', '氏名');
            first.memberCounts.put(UserInfo.getUserId(), 1);
            first.cardRoles.put(UserInfo.getUserId(), new Map<String, String>{ 'name' => '試験ロール' });
            OrgExplorerPageResponse second = new OrgExplorerPageResponse();
            Test.stopTest();
            Assert.isTrue(second.nodes.isEmpty(), '前の応答のユーザーを引き継がない');
            Assert.isTrue(second.memberColumns.isEmpty(), '前の応答の列権限を引き継がない');
            Assert.isTrue(second.memberColumnLabels.isEmpty(), '前の応答の列ラベルを引き継がない');
            Assert.isTrue(second.memberCounts.isEmpty(), '前の応答の人数を引き継がない');
            Assert.isTrue(second.cardRoles.isEmpty(), '前の応答の所属情報を引き継がない');
        }
    }

    /** ノードの未設定状態を初期化 */
    @IsTest
    static void initializesNodeState() {

        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerPageResponse.Node value = new OrgExplorerPageResponse.Node();
            Test.stopTest();
            Assert.areEqual('', value.key, 'keyの初期契約を維持');
            Assert.areEqual('', value.kind, 'kindの初期契約を維持');
            Assert.isNull(value.recordId, 'recordIdを未設定として扱う');
            Assert.areEqual('', value.parentKey, 'parentKeyの初期契約を維持');
            Assert.areEqual(false, value.isActive, 'isActiveの初期契約を維持');
            Assert.areEqual('NOT_APPLICABLE', value.titleState, 'titleStateの初期契約を維持');
            Assert.areEqual('NOT_APPLICABLE', value.departmentState, 'departmentStateの初期契約を維持');
            Assert.areEqual('', value.email, 'emailの初期契約を維持');
            Assert.isNull(value.managerId, 'managerIdを未設定として扱う');
            Assert.areEqual('', value.managerName, 'managerNameの初期契約を維持');
            Assert.areEqual('', value.employeeNumber, '従業員番号を空欄で初期化');
            Assert.areEqual('', value.profileName, 'profileNameの初期契約を維持');
            Assert.areEqual('', value.roleName, 'roleNameの初期契約を維持');
        }
    }
}
