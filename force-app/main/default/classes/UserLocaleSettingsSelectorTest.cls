/** 本人だけの言語・地域設定取得の検証 */
@IsTest
private class UserLocaleSettingsSelectorTest {

    private static UserLocaleSettingsSelector selector = new UserLocaleSettingsSelector();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 検索対象がログインユーザーだけに限定される */
    @IsTest
    static void selectsOnlyCurrentUser() {

        System.runAs(testUser) {
            Test.startTest();
            List<User> records = selector.getCurrentUser();
            Test.stopTest();
            Assert.areEqual(1, records.size(), '本人だけ取得する');
            Assert.areEqual(testUser.Id, records[0].Id, 'ログインユーザーが対象になる');
            Assert.areEqual(UserInfo.getLanguage(), records[0].LanguageLocaleKey, '言語を取得する');
            Assert.areEqual(UserInfo.getLocale(), records[0].LocaleSidKey, '地域を取得する');
        }

    }
}
