/**
 * OrgEnvironment テスト
 */
@IsTest
private with sharing class OrgEnvironmentTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * Organization の Sandbox 区分を返却
     */
    @IsTest
    static void shouldReturnOrganizationSandboxStatus() {
        Boolean expectedSandboxStatus;
        Boolean actualSandboxStatus;

        System.runAs(testUser) {
            // 比較対象となる現在組織の Sandbox 区分を取得
            List<Organization> organizations = [
                SELECT IsSandbox
                FROM Organization
                WITH SYSTEM_MODE
                LIMIT 1
            ];
            expectedSandboxStatus = organizations[0].IsSandbox;

            Test.startTest();

            actualSandboxStatus = OrgEnvironment.isSandbox();

            Test.stopTest();
        }

        // 公開メソッドの判定結果が組織情報と一致することを確認
        Assert.areEqual(
            expectedSandboxStatus,
            actualSandboxStatus,
            'Sandbox 判定結果は Organization.IsSandbox と一致する必要あり'
        );
    }

    /**
     * 同一トランザクション内の再呼び出しで判定結果を再利用
     */
    @IsTest
    static void shouldReuseSandboxStatusWithinTransaction() {
        Boolean firstSandboxStatus;
        Boolean secondSandboxStatus;
        Integer queryCountBeforeFirstCall;
        Integer queryCountAfterFirstCall;
        Integer queryCountAfterSecondCall;

        System.runAs(testUser) {
            Test.startTest();

            queryCountBeforeFirstCall = Limits.getQueries();
            firstSandboxStatus = OrgEnvironment.isSandbox();
            queryCountAfterFirstCall = Limits.getQueries();
            secondSandboxStatus = OrgEnvironment.isSandbox();
            queryCountAfterSecondCall = Limits.getQueries();

            Test.stopTest();
        }

        // 初回取得だけが SOQL を消費することを確認
        Assert.areEqual(
            queryCountBeforeFirstCall + 1,
            queryCountAfterFirstCall,
            '初回の Sandbox 判定では Organization を 1 回問い合わせる必要あり'
        );
        Assert.areEqual(
            queryCountAfterFirstCall,
            queryCountAfterSecondCall,
            '再呼び出しでは Organization を追加問い合わせしない必要あり'
        );
        Assert.areEqual(
            firstSandboxStatus,
            secondSandboxStatus,
            '再呼び出しでは初回と同じ Sandbox 判定結果を返す必要あり'
        );
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