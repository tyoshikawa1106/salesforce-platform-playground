/** AccountDeleteBatchSchedulerの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchSchedulerTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void startsScheduledBatch() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            Test.startTest();
            System.schedule('Account delete schedule test', '0 0 0 1 1 ? 2099', new AccountDeleteBatchScheduler());
            Test.stopTest();
            Assert.areEqual(
                1,
                [SELECT COUNT() FROM AsyncApexJob WHERE ApexClass.Name = 'AccountDeleteBatch'],
                '定期起動からバッチを登録'
            );
        }
    }

    @IsTest
    static void notifiesRejectedStart() {
        User denied = TestDataFactory.createUser('Delete permission test', TestDataFactory.SaveMode.INSERT_RECORD);
        System.runAs(denied) {
            Test.startTest();
            new AccountDeleteBatchScheduler().execute(null);
            Assert.areEqual(1, Limits.getEmailInvocations(), '開始拒否を通知');
            Test.stopTest();
            Assert.areEqual(
                0,
                [SELECT COUNT() FROM AsyncApexJob WHERE ApexClass.Name = 'AccountDeleteBatch'],
                '拒否時は登録なし'
            );
        }
    }

    @IsTest
    static void rejectsRegisteredJob() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            new AccountDeleteBatchScheduler().execute(null);
            Assert.areEqual(1, Limits.getEmailInvocations(), '重複拒否を通知');
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