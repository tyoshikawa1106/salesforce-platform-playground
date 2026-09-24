/** 未確認の削除要求がバッチを開始しないことを検証 */
@IsTest
private with sharing class TestDataDeleteControllerTest {
    @IsTest
    static void rejectsUserWithoutEffectiveModifyAllData() {
        List<Profile> profiles = [
            SELECT Id
            FROM Profile
            WHERE PermissionsModifyAllData = FALSE AND UserLicense.Name = 'Salesforce'
            LIMIT 1
        ];
        Assert.isFalse(profiles.isEmpty(), '権限不足の検証用プロファイルが必要');
        User denied = TestDataFactory.createUser('削除権限なし', TestDataFactory.SaveMode.DO_NOT_INSERT);
        denied.ProfileId = profiles[0].Id;
        insert denied;
        System.runAs(denied) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.startRun('DELETE_ALL');
            Test.stopTest();
            Assert.areEqual('', response.jobId, '実効権限のないユーザーは開始できない');
            Assert.isTrue(response.errorMessage.contains('すべてのデータの編集'), '必要権限を案内');
        }
    }
    /** プロビジョニングに依存せず許可済みの実効権限境界を再現 */
    private class AllowedSelector extends TestDataDeleteSelector {
        /** 合成済みの権限応答を再現
         * @return 許可済みの実効権限
         */
        public override List<UserPermissionAccess> getPermissions() {
            return new List<UserPermissionAccess>{
                (UserPermissionAccess) JSON.deserialize(
                    '{"PermissionsModifyAllData":true,"PermissionsQueryAllFiles":true}',
                    UserPermissionAccess.class
                )
            };
        }
    }

    @IsTest
    static void acceptsOnlyConfirmedRequestAndTracksSameJob() {
        TestDataDeleteController.selector = new AllowedSelector();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Test.startTest();
            TestDataDeleteWrapper accepted = TestDataDeleteController.startRun('DELETE_ALL');
            Assert.areEqual('', accepted.errorMessage, '実効権限があれば確認済み要求を受付');
            Assert.isTrue(String.isNotBlank(accepted.jobId), '受付したジョブIDを返す');
            TestDataDeleteWrapper view = TestDataDeleteController.getView(accepted.jobId);
            Assert.areEqual('RUNNING', view.executionState, '実行中を検知');
            Assert.areEqual(accepted.jobId, String.valueOf(view.jobs[0].Id), '同じジョブを追跡');
            TestDataDeleteWrapper duplicate = TestDataDeleteController.startRun('DELETE_ALL');
            Assert.areEqual('', duplicate.jobId, '実行中の再受付を拒否');
            System.abortJob(accepted.jobId);
            Test.stopTest();
        }
    }

    @IsTest
    static void readsRemainingWithEffectivePermission() {
        TestDataDeleteController.selector = new AllowedSelector();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            TestDataFactory.createAccount('任意の名称', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getRemaining('Account');
            TestDataDeleteWrapper rejected = TestDataDeleteController.getRemaining('User');
            TestDataDeleteWrapper unconfirmed = TestDataDeleteController.startRun('');
            Test.stopTest();
            Assert.areEqual('', response.errorMessage, '対象の件数を確認');
            Assert.areEqual(1, response.remaining, '識別値に依存しない全件数');
            Assert.isTrue(rejected.errorMessage.contains('対象では'), '許可外のオブジェクトを拒否');
            Assert.isTrue(unconfirmed.errorMessage.contains('確認'), '実効権限があっても確認が必要');
        }
    }
    @IsTest
    static void rejectsUnconfirmedStart() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.startRun('');
            Test.stopTest();
            Assert.areEqual('', response.jobId, '確認なしに起動しない');
            Assert.isTrue(String.isNotBlank(response.errorMessage), '停止理由を返す');
        }
    }
    @IsTest
    static void rejectsNonTargetObject() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getRemaining('User');
            Test.stopTest();
            Assert.isTrue(String.isNotBlank(response.errorMessage), '対象外または権限不足を拒否');
        }
    }
    @IsTest
    static void loadsCurrentConditions() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getView(null);
            Test.stopTest();
            Assert.isNotNull(response, '初期画面の応答');
            Assert.isTrue(response.jobs.isEmpty(), '未指定のジョブを推測しない');
        }
    }
}
