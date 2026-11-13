/** AccountDeleteBatchの正常系・拒否・エラー処理テスト */
@IsTest
private with sharing class AccountDeleteBatchTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 同じテストクラスで必要な権限だけを割り当て
     */
    @TestSetup
    static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<PermissionSet> permissions = [SELECT Id FROM PermissionSet WHERE Name = 'LwcAccountDelete'];
        Assert.areEqual(1, permissions.size(), '削除機能のテスト権限が存在');
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = permissions[0].Id);
    }

    /** バッチ実行で取引先を削除 */
    @IsTest
    static void deletesThroughBatchExecution() {

        System.runAs(testUser) {
            insert new Account(Name = '削除対象');
            Test.startTest();
            Id jobId = Database.executeBatch(new AccountDeleteBatch(), 2000);
            Test.stopTest();
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '対象を削除');
            AsyncApexJob job = [SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :jobId];
            Assert.areEqual('Completed', job.Status, 'finishまで正常終了');
            Assert.areEqual(0, job.NumberOfErrors, '非同期処理エラーなし');
        }
    }

    /** 直接起動時も権限を確認 */
    @IsTest
    static void directLaunchStillChecksPermission() {
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'Delete permission test',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert denied;

        System.runAs(denied) {
            insert new Account(Name = '保護対象');
            Test.startTest();
            Database.executeBatch(new AccountDeleteBatch(), 2000);
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '直接起動でも削除しない');
        }
    }

    /** 権限不足でスコープの削除を拒否 */
    @IsTest
    static void executeRejectsWithoutPermission() {
        User denied = new User(
            ProfileId = UserInfo.getProfileId(),
            Alias = 'testuser',
            LastName = 'Delete permission test',
            Email = 'test-user@example.invalid',
            Username = 'test-user.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
            TimeZoneSidKey = 'Asia/Tokyo',
            LocaleSidKey = 'ja_JP',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'ja'
        );
        insert denied;

        System.runAs(denied) {
            Account account = new Account(Name = '削除直前の拒否');
            insert account;
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

    /** 直列化したスコープ間で件数を保持 */
    @IsTest
    static void preservesCountsAcrossSerializedScopes() {

        System.runAs(testUser) {
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
            Assert.areEqual(2, (Integer) wrapper.get('successCount'), 'バッチの成功件数を累積');
            Assert.areEqual(1, (Integer) wrapper.get('failureCount'), '前のスコープの失敗件数を維持');
            Map<String, Object> details = (Map<String, Object>) wrapper.get('recordErrors');
            Assert.isTrue(((String) details.get(String.valueOf(gone.Id))).contains('ENTITY_IS_DELETED'), 'レコードと理由を引き継ぐ');
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '成功した削除結果を維持');
        }
    }

}
