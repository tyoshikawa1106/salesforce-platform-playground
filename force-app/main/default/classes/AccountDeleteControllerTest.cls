/** AccountDeleteControllerの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteControllerTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void readsAndStarts() {
        grantAccess();
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

    @IsTest
    static void rejectsWithoutPermission() {
        User denied = createDeniedUser();
        System.runAs(denied) {
            Test.startTest();
            Assert.isTrue(AccountDeleteController.getView(null).blockMessage.contains('利用権限'), '表示を拒否');
            Assert.isTrue(AccountDeleteController.startRun().blockMessage.contains('利用権限'), '開始も拒否');
            Test.stopTest();
        }
    }

    @IsTest
    static void rejectsDuplicateJob() {
        grantAccess();
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