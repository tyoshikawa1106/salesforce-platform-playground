/** 未確認の削除要求がバッチを開始しないことを検証 */
@IsTest
private with sharing class TestDataDeleteControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());
    private static User deniedUser = createDeniedUser();

    /** すべてのデータの編集権限がなければ拒否 */
    @IsTest
    static void rejectsUserWithoutEffectiveModifyAllData() {
        insert deniedUser;

        System.runAs(deniedUser) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.startRun('DELETE_ALL');
            Test.stopTest();
            Assert.areEqual('', response.jobId, '実効権限のないユーザーは開始できない');
            Assert.isTrue(response.errorMessage.contains('すべてのデータの編集'), '必要権限を案内');
        }
    }

    /** 確認済み要求だけを受け付け同じジョブを追跡 */
    @IsTest
    static void acceptsOnlyConfirmedRequestAndTracksSameJob() {

        System.runAs(testUser) {
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
            Assert.areEqual('', response.errorMessage, '対象の件数を確認');
            Assert.areEqual(1, response.remaining, '識別値に依存しない全件数');
            Assert.isTrue(rejected.errorMessage.contains('対象では'), '許可外のオブジェクトを拒否');
            Assert.isTrue(unconfirmed.errorMessage.contains('確認'), '実効権限があっても確認が必要');
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
            Assert.isTrue(String.isNotBlank(response.errorMessage), '停止理由を返す');
        }
    }

    /** 対象外オブジェクトを拒否 */
    @IsTest
    static void rejectsNonTargetObject() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getRemaining('User');
            Test.stopTest();
            Assert.isTrue(String.isNotBlank(response.errorMessage), '対象外または権限不足を拒否');
        }
    }

    /** 現在の実行条件を取得 */
    @IsTest
    static void loadsCurrentConditions() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteWrapper response = TestDataDeleteController.getView(null);
            Test.stopTest();
            Assert.isNotNull(response, '初期画面の応答');
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
            Assert.areEqual('', response.errorMessage, '件数の取得に成功');
            Assert.areEqual(1, response.remaining, '通常の価格表エントリを残件数に含める');
        }

    }

    /** 権限不足の検証に使う未保存ユーザーを準備
     * @return すべてのデータの編集権限を持たないユーザー
     */
    private static User createDeniedUser() {
        List<Profile> profiles = [
            SELECT Id
            FROM Profile
            WHERE PermissionsModifyAllData = FALSE AND UserLicense.Name = 'Salesforce'
            LIMIT 1
        ];
        Assert.isFalse(profiles.isEmpty(), '権限不足の検証用プロファイルが必要');
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = '削除権限なし',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        denied.ProfileId = profiles[0].Id;
        return denied;
    }

}