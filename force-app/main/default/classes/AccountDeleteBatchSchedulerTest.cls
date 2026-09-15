/** AccountDeleteBatchSchedulerの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchSchedulerTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void startsScheduledBatch() {
        grantAccess();
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
        User denied = createDeniedUser();
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
        grantAccess();
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

    private static User createDeniedUser() {
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'deltest',
            LastName = 'Delete permission test',
            Email = 'delete-test@example.invalid',
            Username = 'delete-test.' +
                UserInfo.getOrganizationId() +
                '.' +
                System.now().getTime() +
                '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert denied;
        return denied;
    }
}