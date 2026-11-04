/** AccountDeleteServiceの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteServiceTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 同じテストクラスで必要な権限だけを割り当て
     */
    @TestSetup
    static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<PermissionSet> permissions = [SELECT Id FROM PermissionSet WHERE Name = 'LwcAccountDelete'];
        Assert.areEqual(1, permissions.size(), '削除機能のテスト権限が存在');
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = permissions[0].Id);
    }

    /** 標準ジョブを画面応答へ反映 */
    @IsTest
    static void displaysStandardJob() {

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

    /** 登録済みジョブがあれば開始を拒否 */
    @IsTest
    static void rejectsRegisteredJob() {

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