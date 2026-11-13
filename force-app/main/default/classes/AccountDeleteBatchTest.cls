/** AccountDeleteBatchの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 公開入口の検証で必要な機能権限を割り当て
     */
    private static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<CustomPermission> permissions = [SELECT Id FROM CustomPermission WHERE DeveloperName = 'RunAccountDelete'];
        PermissionSet access = new PermissionSet(Name = 'AccountDeleteBatchTestAccess', Label = '取引先削除バッチテスト用');
        insert access;
        insert new SetupEntityAccess(ParentId = access.Id, SetupEntityId = permissions[0].Id);
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = access.Id);
    }

    /** 実際の環境に応じて削除または開始拒否を適用 */
    @IsTest
    static void appliesEnvironmentConditionThroughBatchExecution() {
        setupDeleteAccess();

        System.runAs(testUser) {
            Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
            insert new Account(Name = '削除対象');
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            Test.stopTest();
            Assert.areEqual(developmentEnvironment ? 0 : 1, [SELECT COUNT() FROM Account], '許可環境だけで削除し、本番では対象を保持');
            AsyncApexJob job = [SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :jobId];
            Assert.areEqual('Completed', job.Status, 'finishまで正常終了');
            Assert.areEqual(0, job.NumberOfErrors, '非同期処理エラーなし');
        }
    }

    /** 開始拒否時は既存データがあっても空の対象を返す */
    @IsTest
    static void selectsScopeFromBlockMessage() {

        System.runAs(testUser) {
            Account account = new Account(Name = '開始判定の確認');
            insert account;
            AccountDeleteBatch batch = new AccountDeleteBatch();
            Test.startTest();
            Database.QueryLocator blocked = batch.createStartQuery('実行条件を満たしていません。');
            Database.QueryLocator allowed = batch.createStartQuery('');
            Database.QueryLocatorIterator blockedRecords = blocked.iterator();
            Database.QueryLocatorIterator allowedRecords = allowed.iterator();
            Assert.isFalse(blockedRecords.hasNext(), '拒否時は取引先が存在しても対象なし');
            Assert.isTrue(allowedRecords.hasNext(), '許可時は取引先を対象に含める');
            Assert.areEqual(account.Id, allowedRecords.next().Id, '許可時の対象を確認');
            Assert.isFalse(allowedRecords.hasNext(), '準備した一件だけを取得');
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '対象取得では削除を実行しない');
        }
    }

    /** 直列化したスコープ間で件数を保持 */
    @IsTest
    static void preservesCountsAcrossSerializedScopes() {
        setupDeleteAccess();

        System.runAs(testUser) {
            Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
            Account first = new Account(Name = '前半');
            insert first;
            Account gone = new Account(Name = '削除済み');
            insert gone;
            Account second = new Account(Name = '後半');
            insert second;
            delete gone;
            AccountDeleteBatch batch = new AccountDeleteBatch();
            Test.startTest();
            batch.execute(null, new List<SObject>{ first, gone });
            String snapshot = JSON.serialize(batch);
            AccountDeleteBatch restored = (AccountDeleteBatch) JSON.deserialize(snapshot, AccountDeleteBatch.class);
            restored.execute(null, new List<SObject>{ second });
            Map<String, Object> state = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(restored));
            Test.stopTest();
            Map<String, Object> wrapper = (Map<String, Object>) state.get('wrapper');
            Assert.areEqual(developmentEnvironment ? 2 : 0, (Integer) wrapper.get('successCount'), '実際に削除した成功件数を累積');
            Assert.areEqual(developmentEnvironment ? 1 : 3, (Integer) wrapper.get('failureCount'), '削除失敗または環境による拒否件数を累積');
            Map<String, Object> details = (Map<String, Object>) wrapper.get('recordErrors');
            String expectedCode = developmentEnvironment ? 'ENTITY_IS_DELETED' : 'EXECUTION_BLOCKED';
            Assert.areEqual(developmentEnvironment ? 1 : 3, details.size(), '確定した失敗レコードの詳細を保持');
            Assert.isTrue(((String) details.get(String.valueOf(gone.Id))).contains(expectedCode), 'レコードと理由を引き継ぐ');
            Assert.areEqual(developmentEnvironment ? 0 : 2, [SELECT COUNT() FROM Account], '削除結果または環境拒否による保持を確認');
        }
    }

}
