/**
 * 組織探索のErrorの初期状態
 */
@IsTest
private with sharing class OrgExplorerErrorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void initializesUnassignedState() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerError value = new OrgExplorerError();
            Test.stopTest();
            Assert.areEqual('', value.code, 'codeの初期契約を維持');
            Assert.areEqual('', value.message, 'messageの初期契約を維持');
        }
    }
}