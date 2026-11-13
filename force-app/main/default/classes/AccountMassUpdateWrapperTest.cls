/** 画面応答の初期状態テスト */
@IsTest
private with sharing class AccountMassUpdateWrapperTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 空の応答を初期化 */
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
            Assert.isNull(wrapper.startDate, '開始日は未指定');
            Assert.isNull(wrapper.endDate, '終了日は未指定');
            Assert.isNull(wrapper.startAt, '開始日時は未計算');
            Assert.isNull(wrapper.endBefore, '終了日時は未計算');
            Assert.isNull(wrapper.afterCreated, '先頭ページは日時境界なし');
            Assert.isNull(wrapper.afterId, '先頭ページはID境界なし');
        }
    }
}
