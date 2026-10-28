/** 画面の実効権限、許可対象、確認条件を検証 */
@IsTest
private with sharing class TestDataDeleteServiceTest {

    private static TestDataDeleteService service = new TestDataDeleteService();
    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void rejectsWithoutModifyAllData() {
        System.runAs(testUser) {
            UserPermissionAccess permission = (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":false}',
                UserPermissionAccess.class
            );
            TestDataDeleteWrapper result = service.createView(
                new List<UserPermissionAccess>{ permission },
                TestDataDeleteService.Environment.DEVELOPMENT
            );
            Assert.isTrue(result.errorMessage.contains('すべてのデータの編集'), '権限名を案内');
            Assert.isTrue(result.objectNames.isEmpty(), '未許可なら対象を取得しない');
        }
    }
    @IsTest
    static void rejectsProduction() {
        System.runAs(testUser) {
            TestDataDeleteWrapper result = service.createView(
                new List<UserPermissionAccess>(),
                TestDataDeleteService.Environment.DISALLOWED
            );
            Assert.isTrue(result.errorMessage.contains('開発組織'), '本番を拒否');
        }
    }
    @IsTest
    static void allowsWithoutQueryAllFiles() {
        System.runAs(testUser) {
            UserPermissionAccess permission = (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":true,"PermissionsQueryAllFiles":false}',
                UserPermissionAccess.class
            );
            Test.startTest();
            TestDataDeleteWrapper result = service.createView(
                new List<UserPermissionAccess>{ permission },
                TestDataDeleteService.Environment.DEVELOPMENT
            );
            Test.stopTest();
            Assert.isTrue(result.objectNames.contains('ContentDocument'), '全ファイル照会権限なしでも削除計画を生成');
            Assert.isFalse(result.errorMessage.contains('すべてのファイルを照会'), '全ファイル照会権限を必須にしない');
        }
    }
    @IsTest
    static void rejectsObjectOutsidePlan() {
        System.runAs(testUser) {
            TestDataDeleteWrapper initial = new TestDataDeleteWrapper();
            initial.objectNames.add('Account');
            TestDataDeleteWrapper result = service.checkObject(initial, 'User');
            Assert.isTrue(result.errorMessage.contains('対象では'), '任意のAPI名で検索しない');
            Assert.areEqual('', initial.errorMessage, '入力に副作用なし');
        }
    }
    @IsTest
    static void rejectsUnconfirmedRequest() {
        System.runAs(testUser) {
            TestDataDeleteWrapper result = service.checkStart(
                new TestDataDeleteWrapper(),
                new List<AsyncApexJob>(),
                ''
            );
            Assert.isTrue(result.errorMessage.contains('確認'), '画面での確認が必須');
        }
    }
    @IsTest
    static void rejectsActiveJob() {
        System.runAs(testUser) {
            TestDataDeleteWrapper result = service.checkStart(
                new TestDataDeleteWrapper(),
                new List<AsyncApexJob>{ new AsyncApexJob() },
                'DELETE_ALL'
            );
            Assert.areEqual('RUNNING', result.executionState, '実行中を明示');
            Assert.isTrue(result.errorMessage.contains('実行中'), '重複開始を拒否');
        }
    }
    @IsTest
    static void buildsPlanFromEffectivePermission() {
        System.runAs(testUser) {
            UserPermissionAccess permission = (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":true,"PermissionsQueryAllFiles":true}',
                UserPermissionAccess.class
            );
            TestDataDeleteWrapper result = service.createView(
                new List<UserPermissionAccess>{ permission },
                TestDataDeleteService.Environment.DEVELOPMENT
            );
            Assert.isTrue(result.objectNames.contains('Account'), '対象一覧を生成');
            Assert.isTrue(result.labels.containsKey('Account'), '表示名を生成');
        }
    }

    /** 対象一覧の編集で別の要求の計画を変更しない */
    @IsTest
    static void preservesIndependentDependencyOrder() {
        System.runAs(testUser) {
            Test.startTest();
            List<String> first = service.getObjectNames();
            List<String> second = service.getObjectNames();
            first.clear();
            Test.stopTest();
            Assert.areEqual('ContentDocument', second[0], 'ファイルを先に削除');
            Assert.areEqual('Account', second[second.size() - 1], '取引先を最後に削除');
            Assert.isTrue(second.indexOf('Contact') < second.indexOf('Account'), '子を親より先に削除');
            Assert.isTrue(second.indexOf('PricebookEntry') < second.indexOf('Product2'), '価格を商品より先に削除');
            Assert.areEqual(second.size(), new Set<String>(second).size(), '同じ対象を重複登録しない');
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
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(
                new List<Organization>{ organization(false, 'Developer Edition', null) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DEVELOPMENT, actual, 'devを許可');
        }
    }

    @IsTest
    static void permitsUnexpiredScratch() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(
                new List<Organization>{ organization(true, 'Enterprise Edition', System.now().addDays(1)) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DEVELOPMENT, actual, 'EditionによらずScratchを許可');
        }
    }

    @IsTest
    static void deniesSandboxEvenWithDeveloperEdition() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(
                new List<Organization>{ organization(true, 'Developer Edition', null) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DISALLOWED, actual, '一般Sandboxを拒否');
        }
    }

    @IsTest
    static void deniesProductionOrganization() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(
                new List<Organization>{ organization(false, 'Enterprise Edition', null) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DISALLOWED, actual, '本番を拒否');
        }
    }

    @IsTest
    static void deniesTrialOrganization() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(
                new List<Organization>{ organization(false, 'Enterprise Edition', System.now().addDays(1)) }
            );
            Test.stopTest();
            Assert.areEqual(
                TestDataDeleteService.Environment.DISALLOWED,
                actual,
                '有効期限だけでTrialをScratchと誤認しない'
            );
        }
    }

    @IsTest
    static void deniesExpiredScratch() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(
                new List<Organization>{ organization(true, 'Developer Edition', System.now().addDays(-1)) }
            );
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DISALLOWED, actual, '期限切れScratchを拒否');
        }
    }

    @IsTest
    static void deniesMissingOrganization() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(new List<Organization>());
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DISALLOWED, actual, '取得失敗時は拒否');
        }
    }

    @IsTest
    static void deniesNullOrganizationResult() {
        System.runAs(testUser) {
            Test.startTest();
            TestDataDeleteService.Environment actual = service.getEnvironment(null);
            Test.stopTest();
            Assert.areEqual(TestDataDeleteService.Environment.DISALLOWED, actual, '未取得時は拒否');
        }
    }
}
