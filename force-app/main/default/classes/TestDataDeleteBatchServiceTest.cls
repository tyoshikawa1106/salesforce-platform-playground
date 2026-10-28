/** 環境・権限・部分失敗・継続条件を検証 */
@IsTest
private with sharing class TestDataDeleteBatchServiceTest {

    private static TestDataDeleteBatchService service = new TestDataDeleteBatchService();

    private static User testUser = TestDataFactory.getTestUser();

    /** 価格の段階と次の対象をまたいでも全体件数を保持 */
    @IsTest
    static void preservesTotalsAcrossPricePhasesForFinalMail() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('PricebookEntry');
            current.totalSuccessCount = 27;
            current.totalFailureCount = 2;
            Test.startTest();
            TestDataDeleteBatchWrapper standard = service.createNext(current);
            TestDataDeleteBatchWrapper product = service.createNext(standard);
            Messaging.SingleEmailMessage mail = service.buildResultMail(
                product,
                '途中停止',
                'PricebookEntry: 削除失敗'
            );
            Test.stopTest();
            Assert.areEqual(27, product.totalSuccessCount, '全段階の成功件数を保持');
            Assert.areEqual(2, product.totalFailureCount, '全段階の失敗件数を保持');
            Assert.areEqual(0, product.successCount, '段階単位の集計は初期化');
            Assert.areEqual('テストデータ一括削除: 途中停止', mail.getSubject(), '成功と停止を区別');
            Assert.isTrue(mail.getPlainTextBody().contains('27件'), '全体の成功件数を通知');
            Assert.isTrue(mail.getPlainTextBody().contains('2件'), '全体の失敗件数を通知');
            Assert.isTrue(mail.getPlainTextBody().contains('PricebookEntry: 削除失敗'), '安全な停止理由を通知');
            Assert.areEqual(testUser.Id, mail.getTargetObjectId(), '実行ユーザーへ通知');
        }
    }

    /** 正常終了の本文に停止扱いを含めない */
    @IsTest
    static void buildsCompletedMail() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            Test.startTest();
            Messaging.SingleEmailMessage mail = service.buildResultMail(
                current,
                '完了',
                '最後の対象まで処理を終了しました。'
            );
            Test.stopTest();
            Assert.areEqual('テストデータ一括削除: 完了', mail.getSubject(), '正常終了を通知');
            Assert.isFalse(mail.getPlainTextBody().contains('停止理由'), '正常終了に停止理由を含めない');
            Assert.isFalse(mail.getSaveAsActivity(), '通知用の活動を作成しない');
        }
    }

    private static List<UserPermissionAccess> access(Boolean allowed) {
        return new List<UserPermissionAccess>{
            (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":' + allowed + ',"PermissionsQueryAllFiles":false}',
                UserPermissionAccess.class
            )
        };
    }

    /** 本番環境を拒否 */
    @IsTest
    static void deniesProduction() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteBatchWrapper result = service
                .checkExecution(
                    new TestDataDeleteBatchWrapper(),
                    access(true),
                    TestDataDeleteService.Environment.DISALLOWED
                );
            Assert.isNotNull(result.errorMessage, '本番の停止理由');
            Assert.isTrue(result.errorMessage.contains('開発組織'), '環境を拒否');
            Test.stopTest();
        }
    }

    /** 実効権限不足を拒否 */
    @IsTest
    static void deniesMissingPermission() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteBatchWrapper result = service
                .checkExecution(
                    new TestDataDeleteBatchWrapper(),
                    access(false),
                    TestDataDeleteService.Environment.DEVELOPMENT
                );
            Assert.isTrue(result.errorMessage.contains('権限'), '実効権限なしを拒否');
            Test.stopTest();
        }
    }

    /** 変更された削除計画を拒否 */
    @IsTest
    static void rejectsModifiedPlan() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.objectNames[0] = 'User';
            TestDataDeleteBatchWrapper result = service
                .checkExecution(plan, access(true), TestDataDeleteService.Environment.DEVELOPMENT);
            Assert.isTrue(result.errorMessage.contains('不正'), '許可外オブジェクトを拒否');
            Test.stopTest();
        }
    }

    /** 実行可能な取引先削除段階を許可 */
    @IsTest
    static void acceptsAccountStage() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Account');
            TestDataDeleteBatchWrapper result = service
                .checkExecution(plan, access(true), TestDataDeleteService.Environment.DEVELOPMENT);
            Assert.areEqual('', result.errorMessage, '適切な対象と権限を許可');
            Test.stopTest();
        }
    }

    /** 全ファイル照会権限なしでもファイル削除段階を許可 */
    @IsTest
    static void acceptsFilesWithoutQueryAllFiles() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('ContentDocument');
            Test.startTest();
            TestDataDeleteBatchWrapper result = service
                .checkExecution(plan, access(true), TestDataDeleteService.Environment.DEVELOPMENT);
            Test.stopTest();
            Assert.areEqual('', result.errorMessage, '全ファイル照会権限なしでもファイル処理を許可');
        }
    }

    /** 未処理のスコープ例外で後続を停止 */
    @IsTest
    static void stopsOnScopeException() {

        System.runAs(testUser) {
            Test.startTest();
            List<AsyncApexJob> jobs = new List<AsyncApexJob>{
                (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":1}', AsyncApexJob.class)
            };
            String reason = service.getStopReason(new TestDataDeleteBatchWrapper(), jobs, 0);
            Assert.isTrue(reason.contains('未処理'), 'Statefulへ反映されない例外も検知');
            Test.stopTest();
        }
    }

    /** 残存レコードがあれば後続を停止 */
    @IsTest
    static void stopsOnRemainingRows() {

        System.runAs(testUser) {
            Test.startTest();
            List<AsyncApexJob> jobs = new List<AsyncApexJob>{
                (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":0}', AsyncApexJob.class)
            };
            String reason = service.getStopReason(new TestDataDeleteBatchWrapper(), jobs, 1);
            Assert.isTrue(reason.contains('残って'), '後から追加されたレコードも検知');
            Test.stopTest();
        }
    }

    /** 部分失敗を集計して後続を停止 */
    @IsTest
    static void stopsOnPartialFailure() {

        System.runAs(testUser) {
            Test.startTest();
            Account first = TestDataFactory.createAccount('削除可能', TestDataFactory.SaveMode.INSERT_RECORD);
            Account gone = TestDataFactory.createAccount('削除済み', TestDataFactory.SaveMode.INSERT_RECORD);
            delete gone;
            List<Database.DeleteResult> results = Database.delete(new List<Account>{ first, gone }, false);
            TestDataDeleteBatchWrapper original = new TestDataDeleteBatchWrapper();
            TestDataDeleteBatchWrapper result = service.aggregateResults(original, results);
            Assert.areEqual(1, result.successCount, '成功一件');
            Assert.areEqual(1, result.failureCount, '失敗一件');
            Assert.areEqual(0, original.successCount, '入力は変更しない');
            Assert.isTrue(result.errorCodes.contains('ENTITY_IS_DELETED'), '安全なエラーコードを保持');
            String reason = service.getStopReason(
                result,
                new List<AsyncApexJob>{ (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":0}', AsyncApexJob.class) },
                0
            );
            Assert.isTrue(reason.contains('削除失敗'), '残件数ゼロでも部分失敗を隠さない');
            Test.stopTest();
        }
    }

    /** 一段階だけ進め集計を初期化 */
    @IsTest
    static void advancesOnlyOneObject() {

        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteBatchWrapper first = new TestDataDeleteBatchWrapper();
            first.successCount = 200;
            TestDataDeleteBatchWrapper next = service.createNext(first);
            Assert.areEqual(1, next.position, '次の対象だけへ進む');
            Assert.areEqual(0, next.successCount, '対象ごとの集計へ初期化');
            Assert.areEqual(0, first.position, '元の状態を変更しない');
            Test.stopTest();
        }
    }

    /** カスタム価格の次に標準価格へ進む */
    @IsTest
    static void advancesFromCustomPricesToStandardPrices() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('PricebookEntry');
            current.successCount = 3;
            Test.startTest();
            TestDataDeleteBatchWrapper next = service.createNext(current);
            Test.stopTest();
            Assert.areEqual(current.position, next.position, '同じ価格表エントリの段階を継続');
            Assert.isTrue(next.standardPricePhase, 'カスタム価格の次に標準価格を処理');
            Assert.isTrue(new TestDataDeleteBatchWrapper(next).standardPricePhase, 'バッチの状態複製で価格段階を保持');
            Assert.areEqual(0, next.successCount, '段階ごとに集計を初期化');
            Assert.isFalse(current.standardPricePhase, '元の計画を変更しない');
        }

    }

    /** 標準価格の次に商品へ進む */
    @IsTest
    static void advancesFromStandardPricesToProducts() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('PricebookEntry');
            current.standardPricePhase = true;
            Test.startTest();
            TestDataDeleteBatchWrapper next = service.createNext(current);
            Test.stopTest();
            Assert.areEqual('Product2', next.objectNames[next.position], '標準価格の完了後に商品へ進む');
            Assert.isFalse(next.standardPricePhase, '次の対象へ価格段階を持ち越さない');
        }

    }
}
