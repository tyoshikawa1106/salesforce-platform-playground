/**
 * 取引先削除の未受付応答テスト
 */
@IsTest
private with sharing class AccountDeleteWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 未受付の応答を成功と誤認しない
     */
    @IsTest
    static void initializesWithoutJob() {
        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper result = new AccountDeleteWrapper();
            Test.stopTest();
            Assert.areEqual('', result.jobId, '未受付');
            Assert.areEqual('', result.blockMessage, '未判定');
            Assert.isNull(result.latestJob.Id, 'ジョブなし');
        }
    }
}