/** AccountDeleteBatchの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void deletesThroughBatchExecution() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            TestDataFactory.createAccount('削除対象', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            Test.stopTest();
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '対象を削除');
            AsyncApexJob job = [SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :jobId];
            Assert.areEqual('Completed', job.Status, 'finishまで正常終了');
            Assert.areEqual(0, job.NumberOfErrors, '非同期処理エラーなし');
        }
    }

    @IsTest
    static void directLaunchStillChecksPermission() {
        User denied = TestDataFactory.createUser('Delete permission test', TestDataFactory.SaveMode.INSERT_RECORD);
        System.runAs(denied) {
            TestDataFactory.createAccount('保護対象', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            Database.executeBatch(new AccountDeleteBatch(), 2000);
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '直接起動でも削除しない');
        }
    }

    @IsTest
    static void executeRejectsWithoutPermission() {
        User denied = TestDataFactory.createUser('Delete permission test', TestDataFactory.SaveMode.INSERT_RECORD);
        System.runAs(denied) {
            Account account = TestDataFactory.createAccount('削除直前の拒否', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            AccountDeleteBatch batch = new AccountDeleteBatch();
            batch.execute(null, new List<SObject>{ account });
            Map<String, Object> state = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(batch));
            Map<String, Object> wrapper = (Map<String, Object>) state.get('wrapper');
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account WHERE Id = :account.Id], 'executeでも権限を再確認');
            Assert.areEqual(1, (Integer) wrapper.get('failureCount'), '削除できなかった対象を失敗に数える');
            Assert.areEqual('取引先一括削除の利用権限がありません。', wrapper.get('errorMessage'), 'Serviceの判定結果を保持');
            Map<String, Object> details = (Map<String, Object>) wrapper.get('recordErrors');
            Assert.isTrue(((String) details.get(String.valueOf(account.Id))).contains('利用権限がありません'), '中止したレコードと理由を保持');
        }
    }

    @IsTest
    static void preservesCountsAcrossSerializedScopes() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'AccountDelete');
        System.runAs(testUser) {
            Account first = TestDataFactory.createAccount('前半', TestDataFactory.SaveMode.INSERT_RECORD);
            Account gone = TestDataFactory.createAccount('削除済み', TestDataFactory.SaveMode.INSERT_RECORD);
            Account second = TestDataFactory.createAccount('後半', TestDataFactory.SaveMode.INSERT_RECORD);
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
            Assert.areEqual(2, (Integer) wrapper.get('successCount'), 'バッチの成功件数を累積');
            Assert.areEqual(1, (Integer) wrapper.get('failureCount'), '前のスコープの失敗件数を維持');
            Map<String, Object> details = (Map<String, Object>) wrapper.get('recordErrors');
            Assert.isTrue(((String) details.get(String.valueOf(gone.Id))).contains('ENTITY_IS_DELETED'), 'レコードと理由を引き継ぐ');
            Assert.areEqual(0, ((Map<String, Object>) state.get('service')).size(), 'Serviceには状態を保持しない');
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '成功した削除結果を維持');
        }
    }
}