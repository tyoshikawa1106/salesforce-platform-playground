/** 画面応答の初期状態テスト */
@IsTest
private with sharing class AccountMassUpdateWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void initializesEmptyResponse() {
        System.runAs(testUser) {
            Test.startTest();
            AccountMassUpdateWrapper wrapper = new AccountMassUpdateWrapper();
            Test.stopTest();
            Assert.areEqual('', wrapper.errorMessage, '未実行時にエラーなし');
            Assert.isTrue(wrapper.records.isEmpty(), '空のレコード一覧');
            Assert.isTrue(wrapper.errors.isEmpty(), '空の行エラー');
            Assert.isTrue(wrapper.successIds.isEmpty(), '保存済み行なし');
            Assert.isFalse(wrapper.hasNext, '次ページなし');
        }
    }
}