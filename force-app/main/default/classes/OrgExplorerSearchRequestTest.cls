/**
 * 組織探索のSearchRequestの初期状態
 */
@IsTest
private with sharing class OrgExplorerSearchRequestTest {

    private static User testUser = TestDataFactory.getTestUser();

    /** 未設定の検索要求を初期化 */
    @IsTest
    static void initializesUnassignedState() {

        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerSearchRequest value = new OrgExplorerSearchRequest();
            Test.stopTest();
            Assert.areEqual('', value.requestId, 'requestIdの初期契約を維持');
            Assert.areEqual('', value.term, 'termの初期契約を維持');
            Assert.areEqual('', value.developerName, 'developerNameの初期契約を維持');
            Assert.areEqual('ALL', value.activityFilter, 'activityFilterの初期契約を維持');
        }
    }
}
