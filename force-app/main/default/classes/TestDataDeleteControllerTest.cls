/** 未確認の削除要求がバッチを開始しないことを検証 */
@IsTest
private with sharing class TestDataDeleteControllerTest {

    private static TestDataDeleteService service = new TestDataDeleteService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    private static String environmentError = service.getEnvironment(
        [SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization LIMIT 1]
    ) == TestDataDeleteService.Environment.DEVELOPMENT ? '' : '開発組織でのみ実行できます。';

    /** 確認済み要求だけを受け付け同じジョブを追跡 */
    @IsTest
    static void acceptsOnlyConfirmedRequestAndTracksSameJob() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteWrapper accepted = TestDataDeleteController.startRun('DELETE_ALL');
            Assert.areEqual(environmentError, accepted.errorMessage, '実環境の受付条件を適用');
            if (String.isEmpty(environmentError)) {
                Assert.isTrue(String.isNotBlank(accepted.jobId), '受付したジョブIDを返す');
                TestDataDeleteWrapper view = TestDataDeleteController.getView(accepted.jobId);
                Assert.areEqual('RUNNING', view.executionState, '実行中を検知');
                Assert.areEqual(accepted.jobId, String.valueOf(view.jobs[0].Id), '同じジョブを追跡');
                TestDataDeleteWrapper duplicate = TestDataDeleteController.startRun('DELETE_ALL');
                Assert.areEqual('', duplicate.jobId, '実行中の再受付を拒否');
                System.abortJob(accepted.jobId);
            } else {
                Assert.areEqual('', accepted.jobId, '許可外の環境ではジョブを作成しない');
                Assert.areEqual(0, [SELECT COUNT() FROM AsyncApexJob WHERE ApexClass.Name = 'TestDataDeleteBatch'], '開始拒否時に非同期処理を登録しない');
            }
            Test.stopTest();
        }
    }

    /** 実効権限を適用して残件数を取得 */
    @IsTest
    static void readsRemainingWithEffectivePermission() {

        System.runAs(testUser) {
            insert new Account(Name = '任意の名称');
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getRemaining('Account');
            TestDataDeleteWrapper rejected = TestDataDeleteController.getRemaining('User');
            TestDataDeleteWrapper unconfirmed = TestDataDeleteController.startRun('');
            Test.stopTest();
            Assert.areEqual(environmentError, response.errorMessage, '実環境に応じて件数取得を許可または拒否');
            Assert.areEqual(String.isEmpty(environmentError) ? 1 : 0, response.remaining, '許可された環境でだけ全件数を取得');
            Assert.isTrue(String.isEmpty(environmentError) ? rejected.errorMessage.contains('対象では') : rejected.errorMessage == environmentError, '環境判定の後で対象制限を適用');
            Assert.isTrue(String.isEmpty(environmentError) ? unconfirmed.errorMessage.contains('確認') : unconfirmed.errorMessage == environmentError, '環境判定の後で確認文字列を検証');
        }
    }

    /** 未確認の削除開始を拒否 */
    @IsTest
    static void rejectsUnconfirmedStart() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.startRun('');
            Test.stopTest();
            Assert.areEqual('', response.jobId, '確認なしに起動しない');
            Assert.isTrue(String.isEmpty(environmentError) ? response.errorMessage.contains('確認') : response.errorMessage == environmentError, '未確認または環境拒否の理由を区別');
        }
    }

    /** 対象外オブジェクトを拒否 */
    @IsTest
    static void rejectsNonTargetObject() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getRemaining('User');
            Test.stopTest();
            Assert.isTrue(String.isEmpty(environmentError) ? response.errorMessage.contains('対象では') : response.errorMessage == environmentError, '対象外または環境拒否の理由を区別');
        }
    }

    /** 現在の実行条件を取得 */
    @IsTest
    static void loadsCurrentConditions() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getView(null);
            Test.stopTest();
            Assert.areEqual(environmentError, response.errorMessage, '初期画面にも実環境の判定を適用');
            Assert.isTrue(response.jobs.isEmpty(), '未指定のジョブを推測しない');
        }
    }

    /** 有効な価格表エントリを除外せず集計 */
    @IsTest
    static void countsValidPricebookEntriesWithoutExclusion() {

        System.runAs(testUser) {
            Product2 product = new Product2(Name = '通常の価格', IsActive = true);
            insert product;
            update new Pricebook2(Id = Test.getStandardPricebookId(), IsActive = true);
            insert new PricebookEntry(Pricebook2Id = Test.getStandardPricebookId(), Product2Id = product.Id, UnitPrice = 1200, IsActive = true);
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getRemaining('PricebookEntry');
            Test.stopTest();
            Assert.areEqual(environmentError, response.errorMessage, '価格件数にも実環境の判定を適用');
            Assert.areEqual(String.isEmpty(environmentError) ? 1 : 0, response.remaining, '許可時だけ通常の価格表エントリを集計');
        }

    }

    /** 実効権限不足ならgetViewの後続処理を行わない */
    @IsTest
    static void rejectsGetViewWithoutPermission() {
        System.runAs(testUser) {
            UserPermissionAccess denied = (UserPermissionAccess) JSON.deserialize('{"PermissionsModifyAllData":false}', UserPermissionAccess.class);
            Test.startTest();
            TestDataDeleteWrapper result = TestDataDeleteController.getViewForConditions(null, new List<UserPermissionAccess>{ denied }, TestDataDeleteService.Environment.DEVELOPMENT);
            Assert.areEqual('「すべてのデータの編集」権限が必要です。', result.errorMessage, '実効権限がなければ拒否');
            Assert.areEqual('', result.jobId, '拒否時にジョブを受け付けない');
            Assert.areEqual(0, Limits.getQueries(), '拒否後にデータやジョブを照会しない');
            Assert.areEqual(0, Limits.getDmlStatements(), '拒否後にデータ変更やジョブ登録をしない');
            Test.stopTest();
        }
    }

    /** 実効権限不足ならgetRemainingの後続処理を行わない */
    @IsTest
    static void rejectsGetRemainingWithoutPermission() {
        System.runAs(testUser) {
            UserPermissionAccess denied = (UserPermissionAccess) JSON.deserialize('{"PermissionsModifyAllData":false}', UserPermissionAccess.class);
            Test.startTest();
            TestDataDeleteWrapper result = TestDataDeleteController.getRemainingForConditions('Account', new List<UserPermissionAccess>{ denied }, TestDataDeleteService.Environment.DEVELOPMENT);
            Assert.areEqual('「すべてのデータの編集」権限が必要です。', result.errorMessage, '実効権限がなければ拒否');
            Assert.areEqual('', result.jobId, '拒否時にジョブを受け付けない');
            Assert.areEqual(0, Limits.getQueries(), '拒否後にデータやジョブを照会しない');
            Assert.areEqual(0, Limits.getDmlStatements(), '拒否後にデータ変更やジョブ登録をしない');
            Test.stopTest();
        }
    }

    /** 実効権限不足ならstartRunの後続処理を行わない */
    @IsTest
    static void rejectsStartRunWithoutPermission() {
        System.runAs(testUser) {
            UserPermissionAccess denied = (UserPermissionAccess) JSON.deserialize('{"PermissionsModifyAllData":false}', UserPermissionAccess.class);
            Test.startTest();
            TestDataDeleteWrapper result = TestDataDeleteController.startRunForConditions('DELETE_ALL', new List<UserPermissionAccess>{ denied }, TestDataDeleteService.Environment.DEVELOPMENT);
            Assert.areEqual('「すべてのデータの編集」権限が必要です。', result.errorMessage, '実効権限がなければ拒否');
            Assert.areEqual('', result.jobId, '拒否時にジョブを受け付けない');
            Assert.areEqual(0, Limits.getQueries(), '拒否後にデータやジョブを照会しない');
            Assert.areEqual(0, Limits.getDmlStatements(), '拒否後にデータ変更やジョブ登録をしない');
            Test.stopTest();
        }
    }

}
