/** 言語・地域設定の公開APIの検証 */
@IsTest
private class UserLocaleSettingsControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 本人の設定と選択肢を取得 */
    @IsTest
    static void loadsCurrentSettings() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = UserLocaleSettingsController.getSettings();
            Test.stopTest();
            Assert.areEqual('', result.errorMessage, '取得が成功する');
            Assert.areEqual(UserInfo.getLanguage(), result.language, '本人の言語を取得する');
            Assert.areEqual(UserInfo.getLocale(), result.locale, '本人の地域を取得する');
            Assert.isTrue(result.languages.containsKey('ja'), '日本語の候補がある');
        }

    }

    /** 本人の言語と地域だけを保存 */
    @IsTest
    static void savesCurrentUser() {

        System.runAs(testUser) {
            List<User> beforeRecords = [SELECT TimeZoneSidKey, EmailEncodingKey FROM User WHERE Id = :testUser.Id];
            Test.startTest();
            UserLocaleSettingsWrapper result = UserLocaleSettingsController.saveSettings('en_US', 'en_GB');
            Test.stopTest();
            List<User> records = [SELECT LanguageLocaleKey, LocaleSidKey, TimeZoneSidKey, EmailEncodingKey FROM User WHERE Id = :testUser.Id];
            Assert.areEqual('', result.errorMessage, '保存が成功する');
            Assert.areEqual('en_US', records[0].LanguageLocaleKey, '言語が保存される');
            Assert.areEqual('en_GB', records[0].LocaleSidKey, '個別選択した地域が保存される');
            Assert.areEqual(beforeRecords[0].TimeZoneSidKey, records[0].TimeZoneSidKey, 'タイムゾーンを変えない');
            Assert.areEqual(beforeRecords[0].EmailEncodingKey, records[0].EmailEncodingKey, '文字コードを変えない');
        }

    }

    /** 不正な入力ではDMLを行わない */
    @IsTest
    static void rejectsInvalidInput() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = UserLocaleSettingsController.saveSettings('invalid', 'ja_JP');
            Integer statements = Limits.getDmlStatements();
            Test.stopTest();
            Assert.areEqual('利用可能な言語を選択してください。', result.errorMessage, '不正言語を拒否する');
            Assert.areEqual(0, statements, '拒否された入力では更新しない');
        }

    }
}