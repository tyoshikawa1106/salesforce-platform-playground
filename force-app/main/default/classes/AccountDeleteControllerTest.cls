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
        List<PermissionSet> permissions = [SELECT Id FROM PermissionSet WHERE Name = 'LwcAccountDelete'];
        Assert.areEqual(1, permissions.size(), '削除機能のテスト権限が存在');
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = permissions[0].Id);
    }

    /** 実行状態の取得と削除受付 */
    @IsTest
    static void readsAndStarts() {

        System.runAs(testUser) {
            Test.startTest();
            Assert.areEqual('', AccountDeleteController.getView(null).blockMessage, '実行を許可');
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

    /** 権限不足で開始を拒否 */
    @IsTest
    static void rejectsWithoutPermission() {
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
            Assert.isTrue(AccountDeleteController.getView(null).blockMessage.contains('利用権限'), '表示を拒否');
            Assert.isTrue(AccountDeleteController.startRun().blockMessage.contains('利用権限'), '開始も拒否');
            Test.stopTest();
        }
    }

    /** 実行中ジョブとの重複を拒否 */
    @IsTest
    static void rejectsDuplicateJob() {

        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper first = AccountDeleteController.startRun();
            AccountDeleteWrapper second = AccountDeleteController.startRun();
            Assert.isTrue(second.blockMessage.contains('実行中'), '登録済みの重複を拒否');
            Assert.areEqual('', second.jobId, '新しいジョブは登録しない');
            System.abortJob(first.jobId);
            Test.stopTest();
        }
    }

}