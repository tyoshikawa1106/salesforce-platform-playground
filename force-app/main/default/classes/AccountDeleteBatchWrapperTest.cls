/** バッチ集計結果の初期値とコピーの独立性を確認 */
@IsTest
private with sharing class AccountDeleteBatchWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void initializesEmptyResult() {
        System.runAs(testUser) {
            Test.startTest();
            AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper();
            Test.stopTest();
            Assert.areEqual(0, wrapper.successCount, '成功件数の初期値');
            Assert.areEqual(0, wrapper.failureCount, '失敗件数の初期値');
            Assert.isTrue(wrapper.recordErrors.isEmpty(), '理由コードの初期値');
            Assert.areEqual('', wrapper.errorMessage, 'エラーなしの初期値');
        }
    }

    @IsTest
    static void copiesWithoutSharingMutableState() {
        System.runAs(testUser) {
            AccountDeleteBatchWrapper source = new AccountDeleteBatchWrapper();
            source.successCount = 2;
            source.failureCount = 1;
            Account account = TestDataFactory.createAccount('集計結果のコピー', TestDataFactory.SaveMode.INSERT_RECORD);
            Id recordId = account.Id;
            source.recordErrors.put(recordId, '既存の理由');
            source.failureReasons.add('既存の失敗理由');
            source.errorMessage = '実行できません。';
            Test.startTest();
            AccountDeleteBatchWrapper copied = new AccountDeleteBatchWrapper(source);
            Test.stopTest();
            Assert.areEqual(2, copied.successCount, '成功件数を引き継ぐ');
            Assert.areEqual(1, copied.failureCount, '失敗件数を引き継ぐ');
            Assert.areEqual(source.recordErrors, copied.recordErrors, '理由コードを引き継ぐ');
            Assert.areEqual(source.errorMessage, copied.errorMessage, 'エラーメッセージを引き継ぐ');
            copied.successCount++;
            copied.failureCount++;
            copied.recordErrors.put(recordId, '更新した理由');
            copied.failureReasons.add('追加の失敗理由');
            Assert.areEqual(new Set<String>{ '既存の失敗理由' }, source.failureReasons, '失敗理由のコピーを独立させる');
            Assert.areEqual(2, source.successCount, 'コピーの更新が元の成功件数へ影響しない');
            Assert.areEqual(1, source.failureCount, 'コピーの更新が元の失敗件数へ影響しない');
            Assert.areEqual('既存の理由', source.recordErrors.get(recordId), 'コピーのMapを独立させる');
        }
    }
}