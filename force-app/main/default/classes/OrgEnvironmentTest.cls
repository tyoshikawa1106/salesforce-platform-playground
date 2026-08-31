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
}