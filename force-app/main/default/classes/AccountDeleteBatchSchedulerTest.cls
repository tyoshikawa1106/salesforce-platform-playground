/** AccountDeleteBatchSchedulerの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchSchedulerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 同じテストクラスで必要な権限だけを割り当て
     */
    @TestSetup
    static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<CustomPermission> permissions = [SELECT Id FROM CustomPermission WHERE DeveloperName = 'RunAccountDelete'];
        PermissionSet access = new PermissionSet(Name = 'AccountDeleteScheduleTestAccess', Label = '取引先削除定期実行テスト用');
        insert access;
        insert new SetupEntityAccess(ParentId = access.Id, SetupEntityId = permissions[0].Id);
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = access.Id);
    }

    /** 実際の環境に応じて定期起動を受付または拒否 */
    @IsTest
    static void appliesEnvironmentConditionWhenScheduled() {

        System.runAs(testUser) {
            Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
            Test.startTest();
            System.schedule('Account delete schedule test', '0 0 0 1 1 ? 2099', new AccountDeleteBatchScheduler());
            Test.stopTest();
            Assert.areEqual(
                developmentEnvironment ? 1 : 0,
                [SELECT COUNT() FROM AsyncApexJob WHERE ApexClass.Name = 'AccountDeleteBatch'],
                '許可環境だけで登録し、本番では登録しない'
            );
        }
    }

    /** 実行中ジョブまたは環境で拒否された場合は追加登録しない */
    @IsTest
    static void doesNotAddBatchWhenExecutionIsBlocked() {

        System.runAs(testUser) {
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            new AccountDeleteBatchScheduler().execute(null);
            Assert.areEqual(1, Limits.getEmailInvocations(), '実行を拒否した理由を通知');
            Assert.areEqual(
                1,
                [SELECT COUNT() FROM AsyncApexJob WHERE ApexClass.Name = 'AccountDeleteBatch'],
                '追加登録しない'
            );
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

}
