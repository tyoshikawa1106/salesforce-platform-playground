/** AccountDeleteServiceの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteServiceTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void displaysStandardJob() {
        grantAccess();
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
        grantAccess();
        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper response = new AccountDeleteService()
                .createStartView(new List<AsyncApexJob>{ new AsyncApexJob() });
            Test.stopTest();
            Assert.isTrue(response.blockMessage.contains('実行中'), '起動せず判定結果を返す');
            Assert.areEqual('', response.jobId, '拒否応答に受付IDはない');
        }
    }

    private static void grantAccess() {
        Id permissionId = [SELECT Id FROM PermissionSet WHERE Name = 'AccountDelete' LIMIT 1].Id;
        if (
            [
                SELECT COUNT()
                FROM PermissionSetAssignment
                WHERE AssigneeId = :UserInfo.getUserId() AND PermissionSetId = :permissionId
            ] == 0
        ) {
            insert new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(), PermissionSetId = permissionId);
        }
    }
}