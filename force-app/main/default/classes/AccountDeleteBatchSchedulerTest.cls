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
        List<PermissionSet> permissions = [SELECT Id FROM PermissionSet WHERE Name = 'LwcAccountDelete'];
        Assert.areEqual(1, permissions.size(), '削除機能のテスト権限が存在');
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = permissions[0].Id);
    }

    /** 定期実行からバッチを起動 */
    @IsTest
    static void startsScheduledBatch() {

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

    /** 開始拒否を通知 */
    @IsTest
    static void notifiesRejectedStart() {
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'Delete permission test',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert denied;

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

    /** 登録済みジョブとの重複を拒否 */
    @IsTest
    static void rejectsRegisteredJob() {

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