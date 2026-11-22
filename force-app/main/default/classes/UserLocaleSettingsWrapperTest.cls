/** 言語・地域設定の初期状態の検証 */
@IsTest
private class UserLocaleSettingsWrapperTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 初期状態で編集や更新対象を持たない */
    @IsTest
    static void initializesEmptySettings() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper wrapper = new UserLocaleSettingsWrapper();
            Test.stopTest();
            Assert.areEqual('', wrapper.language, '言語は空で初期化する');
            Assert.areEqual('', wrapper.locale, '地域は空で初期化する');
            Assert.areEqual('', wrapper.errorMessage, '初期状態はエラーなし');
            Assert.isFalse(wrapper.canEdit, '権限確認前は編集不可');
            Assert.isTrue(wrapper.languages.isEmpty(), '言語候補は空');
            Assert.isTrue(wrapper.locales.isEmpty(), '地域候補は空');
            Assert.isNull(wrapper.record.Id, '更新対象を未確定にする');
        }

    }
}