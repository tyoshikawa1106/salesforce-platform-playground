/** AccountDeleteServiceの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteServiceTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void displaysStandardJob() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper response = new AccountDeleteService()
                .createView(
                    new List<AsyncApexJob>{
                        (AsyncApexJob) JSON.deserialize('{"Status":"Aborted"}', AsyncApexJob.class)
                    }
                );
            Test.stopTest();
            Assert.areEqual('Aborted', response.latestJob.Status, '標準状態をそのまま表示');
        }
    }

    @IsTest
    static void rejectsRegisteredJob() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper response = new AccountDeleteService()
                .createStartView(new List<AsyncApexJob>{ new AsyncApexJob() });
            Test.stopTest();
            Assert.isTrue(response.blockMessage.contains('実行中'), '起動せず判定結果を返す');
            Assert.areEqual('', response.jobId, '拒否応答に受付IDはない');
        }
    }
}