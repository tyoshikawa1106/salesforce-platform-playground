/**
 * 組織探索のCapabilitiesResponseの初期状態
 */
@IsTest
private with sharing class OrgExplorerCapabilitiesResponseTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void initializesUnassignedState() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerCapabilitiesResponse value = new OrgExplorerCapabilitiesResponse();
            Test.stopTest();
            Assert.areEqual(true, value.ok, 'okの初期契約を維持');
            Assert.isNull(value.error, 'errorを未設定として扱う');
            Assert.isTrue(value.cardFieldLabels.isEmpty(), '参照確認前にラベルを公開しない');
            Assert.areEqual(false, value.managerModeEnabled, 'managerModeEnabledの初期契約を維持');
            Assert.areEqual(false, value.roleModeEnabled, 'roleModeEnabledの初期契約を維持');
            Assert.areEqual(false, value.roleMembersEnabled, 'roleMembersEnabledの初期契約を維持');
        }
    }
}