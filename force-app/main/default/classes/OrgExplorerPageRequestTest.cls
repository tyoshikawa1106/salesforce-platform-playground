/**
 * 組織探索のPageRequestの初期状態
 */
@IsTest
private with sharing class OrgExplorerPageRequestTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void initializesUnassignedState() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerPageRequest value = new OrgExplorerPageRequest();
            Test.stopTest();
            Assert.areEqual('', value.requestId, 'requestIdの初期契約を維持');
            Assert.areEqual('', value.mode, 'modeの初期契約を維持');
            Assert.areEqual('', value.scope, 'scopeの初期契約を維持');
            Assert.isNull(value.parentId, 'parentIdを未設定として扱う');
            Assert.areEqual(false, value.includeInactive, 'includeInactiveの初期契約を維持');
            Assert.areEqual('', value.cursor, 'cursorの初期契約を維持');
            Assert.isNull(value.paginationCursor, 'paginationCursorを未設定として扱う');
            Assert.areEqual(0, value.startIndex, 'startIndexの初期契約を維持');
            Assert.areEqual(50, value.pageSize, '通常のページサイズを50件に維持');
        }
    }
}