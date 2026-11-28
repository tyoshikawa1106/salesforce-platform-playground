/**
 * OrgEnvironment テスト
 */
@IsTest
private with sharing class OrgEnvironmentTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 組織の Sandbox 区分を一度だけ照会し、同一トランザクション内で再利用 */
    @IsTest
    static void returnsAndCachesOrganizationSandboxStatus() {
        System.runAs(testUser) {
            Organization org = [SELECT IsSandbox FROM Organization WITH SYSTEM_MODE LIMIT 1];
            Test.startTest();
            Integer queriesBefore = Limits.getQueries();
            Boolean first = OrgEnvironment.isSandbox();
            Integer afterFirst = Limits.getQueries();
            Boolean second = OrgEnvironment.isSandbox();
            Integer afterSecond = Limits.getQueries();
            Test.stopTest();

            Assert.areEqual(org.IsSandbox, first, '組織の Sandbox 区分を返す');
            Assert.areEqual(first, second, '再呼び出しは同じ区分を返す');
            Assert.areEqual(queriesBefore + 1, afterFirst, '初回に組織を一度照会する');
            Assert.areEqual(afterFirst, afterSecond, '再呼び出しでは照会しない');
        }
    }

    /**
     * Sandbox区分とDeveloper Editionだけを許可
     */
    @IsTest
    static void allowsDevelopmentTypes() {
        System.runAs(testUser) {
            Test.startTest();
            Assert.isTrue(OrgEnvironment.isAllowedDevelopmentType(true, 'Enterprise Edition'), 'Sandboxを許可');
            Assert.isTrue(OrgEnvironment.isAllowedDevelopmentType(true, 'Developer Edition'), 'ScratchのSandbox区分を許可');
            Assert.isTrue(OrgEnvironment.isAllowedDevelopmentType(false, 'Developer Edition'), 'Developer Editionを許可');
            Assert.isFalse(OrgEnvironment.isAllowedDevelopmentType(false, 'Enterprise Edition'), '本番を拒否');
            Assert.isFalse(OrgEnvironment.isAllowedDevelopmentType(false, ''), '不明なEditionを拒否');
            Assert.isFalse(OrgEnvironment.isAllowedDevelopmentType(null, null), '判定不能を拒否');
            Test.stopTest();
        }
    }

    /**
     * 現在組織の実値と開発環境判定を一致させる
     */
    @IsTest
    static void matchesDevelopmentEnvironment() {
        System.runAs(testUser) {
            List<Organization> orgs = [SELECT IsSandbox, OrganizationType FROM Organization WITH SYSTEM_MODE LIMIT 1];
            Test.startTest();
            Boolean actual = OrgEnvironment.isDevelopmentEnvironment();
            Test.stopTest();
            Assert.areEqual(orgs[0].IsSandbox || orgs[0].OrganizationType == 'Developer Edition', actual, '実値と一致');
        }
    }
}