/** 環境・権限・部分失敗・継続条件を検証 */
@IsTest
private with sharing class TestDataDeleteBatchServiceTest {
    private static TestDataDeleteBatchService mailService = new TestDataDeleteBatchService();
    private static User mailTestUser = TestDataFactory.getTestUser();

    /** 価格の段階と次の対象をまたいでも全体件数を保持 */
    @IsTest
    static void preservesTotalsAcrossPricePhasesForFinalMail() {
        System.runAs(mailTestUser) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('PricebookEntry');
            current.totalSuccessCount = 27;
            current.totalFailureCount = 2;
            Test.startTest();
            TestDataDeleteBatchWrapper standard = mailService.createNext(current);
            TestDataDeleteBatchWrapper product = mailService.createNext(standard);
            Messaging.SingleEmailMessage mail = mailService.buildResultMail(
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
            Assert.areEqual(mailTestUser.Id, mail.getTargetObjectId(), '実行ユーザーへ通知');
        }
    }

    /** 正常終了の本文に停止扱いを含めない */
    @IsTest
    static void buildsCompletedMail() {
        System.runAs(mailTestUser) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            Test.startTest();
            Messaging.SingleEmailMessage mail = mailService.buildResultMail(
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

    private static Organization organization(Boolean sandbox, String edition, Datetime expiration) {
        return (Organization) JSON.deserialize(
            JSON.serialize(
                new Map<String, Object>{
                    'IsSandbox' => sandbox,
                    'OrganizationType' => edition,
                    'TrialExpirationDate' => expiration
                }
            ),
            Organization.class
        );
    }

    @IsTest
    static void permitsDeveloperEdition() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>{ organization(false, 'Developer Edition', null) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DEVELOPMENT, actual, 'devを許可');
        }
    }

    @IsTest
    static void permitsUnexpiredScratch() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>{ organization(true, 'Enterprise Edition', System.now().addDays(1)) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DEVELOPMENT, actual, 'EditionによらずScratchを許可');
        }
    }

    @IsTest
    static void deniesSandboxEvenWithDeveloperEdition() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>{ organization(true, 'Developer Edition', null) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DISALLOWED, actual, '一般Sandboxを拒否');
        }
    }

    @IsTest
    static void deniesProductionOrganization() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>{ organization(false, 'Enterprise Edition', null) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DISALLOWED, actual, '本番を拒否');
        }
    }

    @IsTest
    static void deniesTrialOrganization() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>{ organization(false, 'Enterprise Edition', System.now().addDays(1)) }
            );
            Test.stopTest();
            Assert.areEqual(
                TestDataDeleteBatchWrapper.Environment.DISALLOWED,
                actual,
                '有効期限だけでTrialをScratchと誤認しない'
            );
        }
    }

    @IsTest
    static void deniesExpiredScratch() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>{ organization(true, 'Developer Edition', System.now().addDays(-1)) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DISALLOWED, actual, '期限切れScratchを拒否');
        }
    }

    @IsTest
    static void deniesMissingOrganization() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(
                new List<Organization>()
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DISALLOWED, actual, '取得失敗時は拒否');
        }
    }

    @IsTest
    static void deniesNullOrganizationResult() {
        System.runAs(TestDataFactory.getTestUser()) {
            Test.startTest();
            TestDataDeleteBatchWrapper.Environment actual = TestDataDeleteBatchService.getEnvironment(null);
            Test.stopTest();
            Assert.areEqual(TestDataDeleteBatchWrapper.Environment.DISALLOWED, actual, '未取得時は拒否');
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
    @IsTest
    static void deniesProduction() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper result = new TestDataDeleteBatchService()
                .checkExecution(
                    new TestDataDeleteBatchWrapper(),
                    access(true),
                    TestDataDeleteBatchWrapper.Environment.DISALLOWED
                );
            Assert.isNotNull(result.errorMessage, '本番の停止理由');
            Assert.isTrue(result.errorMessage.contains('開発組織'), '環境を拒否');
        }
    }
    @IsTest
    static void deniesMissingPermission() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper result = new TestDataDeleteBatchService()
                .checkExecution(
                    new TestDataDeleteBatchWrapper(),
                    access(false),
                    TestDataDeleteBatchWrapper.Environment.DEVELOPMENT
                );
            Assert.isTrue(result.errorMessage.contains('権限'), '実効権限なしを拒否');
        }
    }
    @IsTest
    static void rejectsModifiedPlan() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.objectNames[0] = 'User';
            TestDataDeleteBatchWrapper result = new TestDataDeleteBatchService()
                .checkExecution(plan, access(true), TestDataDeleteBatchWrapper.Environment.DEVELOPMENT);
            Assert.isTrue(result.errorMessage.contains('不正'), '許可外オブジェクトを拒否');
        }
    }
    @IsTest
    static void acceptsAccountStage() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Account');
            TestDataDeleteBatchWrapper result = new TestDataDeleteBatchService()
                .checkExecution(plan, access(true), TestDataDeleteBatchWrapper.Environment.DEVELOPMENT);
            Assert.areEqual('', result.errorMessage, '適切な対象と権限を許可');
        }
    }
    @IsTest
    static void acceptsFilesWithoutQueryAllFiles() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('ContentDocument');
            Test.startTest();
            TestDataDeleteBatchWrapper result = new TestDataDeleteBatchService()
                .checkExecution(plan, access(true), TestDataDeleteBatchWrapper.Environment.DEVELOPMENT);
            Test.stopTest();
            Assert.areEqual('', result.errorMessage, '全ファイル照会権限なしでもファイル処理を許可');
        }
    }
    @IsTest
    static void stopsOnScopeException() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<AsyncApexJob> jobs = new List<AsyncApexJob>{
                (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":1}', AsyncApexJob.class)
            };
            String reason = new TestDataDeleteBatchService().getStopReason(new TestDataDeleteBatchWrapper(), jobs, 0);
            Assert.isTrue(reason.contains('未処理'), 'Statefulへ反映されない例外も検知');
        }
    }
    @IsTest
    static void stopsOnRemainingRows() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<AsyncApexJob> jobs = new List<AsyncApexJob>{
                (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":0}', AsyncApexJob.class)
            };
            String reason = new TestDataDeleteBatchService().getStopReason(new TestDataDeleteBatchWrapper(), jobs, 1);
            Assert.isTrue(reason.contains('残って'), '後から追加されたレコードも検知');
        }
    }
    @IsTest
    static void stopsOnPartialFailure() {
        System.runAs(TestDataFactory.getTestUser()) {
            Account first = TestDataFactory.createAccount('削除可能', TestDataFactory.SaveMode.INSERT_RECORD);
            Account gone = TestDataFactory.createAccount('削除済み', TestDataFactory.SaveMode.INSERT_RECORD);
            delete gone;
            List<Database.DeleteResult> results = Database.delete(new List<Account>{ first, gone }, false);
            TestDataDeleteBatchWrapper original = new TestDataDeleteBatchWrapper();
            TestDataDeleteBatchService service = new TestDataDeleteBatchService();
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
        }
    }
    @IsTest
    static void advancesOnlyOneObject() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper first = new TestDataDeleteBatchWrapper();
            first.successCount = 200;
            TestDataDeleteBatchWrapper next = new TestDataDeleteBatchService().createNext(first);
            Assert.areEqual(1, next.position, '次の対象だけへ進む');
            Assert.areEqual(0, next.successCount, '対象ごとの集計へ初期化');
            Assert.areEqual(0, first.position, '元の状態を変更しない');
        }
    }

    @IsTest
    static void advancesFromCustomPricesToStandardPrices() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('PricebookEntry');
            current.successCount = 3;
            Test.startTest();
            TestDataDeleteBatchWrapper next = new TestDataDeleteBatchService().createNext(current);
            Test.stopTest();
            Assert.areEqual(current.position, next.position, '同じ価格表エントリの段階を継続');
            Assert.isTrue(next.standardPricePhase, 'カスタム価格の次に標準価格を処理');
            Assert.isTrue(new TestDataDeleteBatchWrapper(next).standardPricePhase, 'バッチの状態複製で価格段階を保持');
            Assert.areEqual(0, next.successCount, '段階ごとに集計を初期化');
            Assert.isFalse(current.standardPricePhase, '元の計画を変更しない');
        }

    }

    @IsTest
    static void advancesFromStandardPricesToProducts() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('PricebookEntry');
            current.standardPricePhase = true;
            Test.startTest();
            TestDataDeleteBatchWrapper next = new TestDataDeleteBatchService().createNext(current);
            Test.stopTest();
            Assert.areEqual('Product2', next.objectNames[next.position], '標準価格の完了後に商品へ進む');
            Assert.isFalse(next.standardPricePhase, '次の対象へ価格段階を持ち越さない');
        }

    }
}
