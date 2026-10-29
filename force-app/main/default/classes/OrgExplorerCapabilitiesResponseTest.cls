/**
 * 組織探索のCapabilitiesResponseの初期状態
 */
@IsTest
private with sharing class OrgExplorerCapabilitiesResponseTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 未設定の機能応答を初期化 */
    @IsTest
    static void initializesUnassignedState() {

        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerCapabilitiesResponse value = new OrgExplorerCapabilitiesResponse();
            Test.stopTest();
            Assert.isTrue(value.cardFieldLabels.isEmpty(), '参照確認前にラベルを公開しない');
            Assert.areEqual(false, value.managerModeEnabled, 'managerModeEnabledの初期契約を維持');
            Assert.areEqual(false, value.roleModeEnabled, 'roleModeEnabledの初期契約を維持');
            Assert.areEqual(false, value.roleMembersEnabled, 'roleMembersEnabledの初期契約を維持');
        }
    }
}