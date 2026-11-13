/** AccountDeleteControllerの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 同じテストクラスで必要な権限だけを割り当て
     */
    @TestSetup
    static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<CustomPermission> permissions = [SELECT Id FROM CustomPermission WHERE DeveloperName = 'RunAccountDelete'];
        PermissionSet access = new PermissionSet(Name = 'AccountDeleteControllerAccess', Label = 'AccountDeleteController テスト');
        insert access;
        insert new SetupEntityAccess(ParentId = access.Id, SetupEntityId = permissions[0].Id);
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = access.Id);
    }

    /** 実行状態の取得と削除受付 */
    @IsTest
    static void readsAndStarts() {

        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper initial = AccountDeleteController.getView(null);
            if (!OrgEnvironment.isDevelopmentEnvironment()) {
                Assert.isTrue(initial.blockMessage.contains('でのみ実行'), '本番では状態の参照を拒否');
                AccountDeleteWrapper blocked = AccountDeleteController.startRun();
                Assert.areEqual(initial.blockMessage, blocked.blockMessage, '本番では登録も同じ理由で拒否');
                Assert.areEqual('', blocked.jobId, '拒否時に受付IDを返さない');
                Test.stopTest();
                return;
            }
            Assert.areEqual('', initial.blockMessage, '許可環境では実行を受付');
            AccountDeleteWrapper response = AccountDeleteController.startRun();
            Assert.isNotNull(response.jobId, '受付ID');
            Assert.areEqual(
                response.jobId,
                String.valueOf(AccountDeleteController.getView(Id.valueOf(response.jobId)).latestJob.Id),
                '標準ジョブを取得'
            );
            System.abortJob(response.jobId);
            Test.stopTest();
        }
    }

    /** 実行中ジョブとの重複を拒否 */
    @IsTest
    static void rejectsDuplicateJob() {

        System.runAs(testUser) {
            Test.startTest();
            if (!OrgEnvironment.isDevelopmentEnvironment()) {
                Assert.isTrue(AccountDeleteController.startRun().blockMessage.contains('でのみ実行'), '本番では重複判定より先に拒否');
                Test.stopTest();
                return;
            }
            AccountDeleteWrapper first = AccountDeleteController.startRun();
            AccountDeleteWrapper second = AccountDeleteController.startRun();
            Assert.isTrue(second.blockMessage.contains('実行中'), '登録済みの重複を拒否');
            Assert.areEqual('', second.jobId, '新しいジョブは登録しない');
            System.abortJob(first.jobId);
            Test.stopTest();
        }
    }

}
