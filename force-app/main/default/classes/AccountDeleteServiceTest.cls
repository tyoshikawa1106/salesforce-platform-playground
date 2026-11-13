/** AccountDeleteServiceの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteServiceTest {

    private static AccountDeleteService service = new AccountDeleteService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 公開入口の検証で必要な機能権限を割り当て
     */
    private static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<CustomPermission> permissions = [SELECT Id FROM CustomPermission WHERE DeveloperName = 'RunAccountDelete'];
        PermissionSet access = new PermissionSet(Name = 'AccountDeleteServiceAccess', Label = 'AccountDeleteService テスト');
        insert access;
        insert new SetupEntityAccess(ParentId = access.Id, SetupEntityId = permissions[0].Id);
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = access.Id);
    }

    /** 標準ジョブを画面応答へ反映 */
    @IsTest
    static void displaysStandardJob() {
        setupDeleteAccess();

        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper response = service
                .createView(
                    new List<AsyncApexJob>{
                        (AsyncApexJob) JSON.deserialize('{"Status":"Aborted"}', AsyncApexJob.class)
                    }
                );
            Test.stopTest();
            Assert.areEqual(OrgEnvironment.isDevelopmentEnvironment() ? 'Aborted' : null, response.latestJob.Status, '許可環境だけ標準状態を表示');
        }
    }

    /** 登録済みジョブがあれば開始を拒否 */
    @IsTest
    static void rejectsRegisteredJob() {
        setupDeleteAccess();

        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteWrapper response = service
                .createStartView(new List<AsyncApexJob>{ new AsyncApexJob() });
            Test.stopTest();
            Assert.isTrue(response.blockMessage.contains(OrgEnvironment.isDevelopmentEnvironment() ? '実行中' : 'でのみ実行'), '実行環境を優先して重複起動を拒否');
            Assert.areEqual('', response.jobId, '拒否応答に受付IDはない');
        }
    }

    /** 実際の権限差異を作らず許可・環境拒否・権限拒否を検証 */
    @IsTest
    static void evaluatesEnvironmentAndPermissionArguments() {

        System.runAs(testUser) {
            Test.startTest();
            Assert.areEqual('', service.getBlockMessageForConditions(true, true, true), 'すべて満たせば許可');
            Assert.areEqual('Scratch Org・Developer Edition・Sandboxでのみ実行できます。', service.getBlockMessageForConditions(false, true, true), '本番を拒否');
            Assert.areEqual('取引先一括削除の利用権限がありません。', service.getBlockMessageForConditions(true, false, true), 'カスタム権限の不足を拒否');
            Assert.areEqual('取引先の参照・削除権限が必要です。', service.getBlockMessageForConditions(true, true, false), 'CRUD不足を拒否');
            Test.stopTest();
        }
    }

    /** 受付結果は削除完了と区別してジョブIDを返す */
    @IsTest
    static void buildsAcceptedJobResponse() {

        System.runAs(testUser) {
            Id jobId = Id.valueOf(AsyncApexJob.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
            Test.startTest();
            AccountDeleteWrapper response = service.createAcceptedView(jobId);
            Test.stopTest();
            Assert.areEqual(String.valueOf(jobId), response.jobId, '受付したジョブを返す');
            Assert.areEqual('バッチを受け付けました。処理結果をメールで通知します。', response.message, '受付と完了を区別');
        }
    }

}