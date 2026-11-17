/** 認可先の取得とコード交換の公開入口 */
@IsTest
private with sharing class OAuthTokenIssuanceControllerTest {
    @IsTest
    static void returnsCurrentOrganizationOrigin() {
        User currentUser = new User(Id = UserInfo.getUserId());

        System.runAs(currentUser) {
            Test.startTest();
            String origin = OAuthTokenIssuanceController.getAuthorizationOrigin();
            Test.stopTest();
            Assert.areEqual(Url.getOrgDomainUrl().toExternalForm(), origin, 'この組織以外へ認可しない');
        }
    }

    @IsTest
    static void reportsMissingAuthorizationBeforeCallout() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            OAuthTokenIssuanceResult result = OAuthTokenIssuanceController.exchangeCode(null);
            Integer callouts = Limits.getCallouts();
            Test.stopTest();
            Assert.areEqual(0, callouts, '認可情報のない要求を外部へ送らない');
            Assert.isNotNull(result.errorMessage, '画面が表示できる形で失敗理由を返す');
        }
    }
}