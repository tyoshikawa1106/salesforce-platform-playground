/** 画面の実効権限、許可対象、確認条件を検証 */
@IsTest
private with sharing class TestDataDeleteServiceTest {
    @IsTest
    static void rejectsWithoutModifyAllData() {
        System.runAs(TestDataFactory.getTestUser()) {
            UserPermissionAccess permission = (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":false}',
                UserPermissionAccess.class
            );
            TestDataDeleteWrapper result = new TestDataDeleteService()
                .createView(
                    new List<UserPermissionAccess>{ permission },
                    TestDataDeleteBatchWrapper.Environment.DEVELOPMENT
                );
            Assert.isTrue(result.errorMessage.contains('すべてのデータの編集'), '権限名を案内');
            Assert.isTrue(result.objectNames.isEmpty(), '未許可なら対象を取得しない');
        }
    }
    @IsTest
    static void rejectsProduction() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteWrapper result = new TestDataDeleteService()
                .createView(new List<UserPermissionAccess>(), TestDataDeleteBatchWrapper.Environment.DISALLOWED);
            Assert.isTrue(result.errorMessage.contains('開発組織'), '本番を拒否');
        }
    }
    @IsTest
    static void requiresAllFilesVisibility() {
        System.runAs(TestDataFactory.getTestUser()) {
            UserPermissionAccess permission = (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":true,"PermissionsQueryAllFiles":false}',
                UserPermissionAccess.class
            );
            TestDataDeleteWrapper result = new TestDataDeleteService()
                .createView(
                    new List<UserPermissionAccess>{ permission },
                    TestDataDeleteBatchWrapper.Environment.DEVELOPMENT
                );
            Assert.isTrue(result.errorMessage.contains('ファイル'), '見えないファイルを削除済みと扱わない');
        }
    }
    @IsTest
    static void rejectsObjectOutsidePlan() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteWrapper initial = new TestDataDeleteWrapper();
            initial.objectNames.add('Account');
            TestDataDeleteWrapper result = new TestDataDeleteService().checkObject(initial, 'User');
            Assert.isTrue(result.errorMessage.contains('対象では'), '任意のAPI名で検索しない');
            Assert.areEqual('', initial.errorMessage, '入力に副作用なし');
        }
    }
    @IsTest
    static void rejectsUnconfirmedRequest() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteWrapper result = new TestDataDeleteService()
                .checkStart(new TestDataDeleteWrapper(), new List<AsyncApexJob>(), '');
            Assert.isTrue(result.errorMessage.contains('確認'), '画面での確認が必須');
        }
    }
    @IsTest
    static void rejectsActiveJob() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteWrapper result = new TestDataDeleteService()
                .checkStart(new TestDataDeleteWrapper(), new List<AsyncApexJob>{ new AsyncApexJob() }, 'DELETE_ALL');
            Assert.areEqual('RUNNING', result.executionState, '実行中を明示');
            Assert.isTrue(result.errorMessage.contains('実行中'), '重複開始を拒否');
        }
    }
    @IsTest
    static void buildsPlanFromEffectivePermission() {
        System.runAs(TestDataFactory.getTestUser()) {
            UserPermissionAccess permission = (UserPermissionAccess) JSON.deserialize(
                '{"PermissionsModifyAllData":true,"PermissionsQueryAllFiles":true}',
                UserPermissionAccess.class
            );
            TestDataDeleteWrapper result = new TestDataDeleteService()
                .createView(
                    new List<UserPermissionAccess>{ permission },
                    TestDataDeleteBatchWrapper.Environment.DEVELOPMENT
                );
            Assert.isTrue(result.objectNames.contains('Account'), '対象一覧を生成');
            Assert.isTrue(result.labels.containsKey('Account'), '表示名を生成');
        }
    }
}
