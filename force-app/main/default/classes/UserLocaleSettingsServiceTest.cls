/** 言語・地域の候補と保存条件の検証 */
@IsTest
private class UserLocaleSettingsServiceTest {

    private static UserLocaleSettingsService service = new UserLocaleSettingsService();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 現在値を候補に合わせて勝手に変更しない */
    @IsTest
    static void preservesCurrentSettings() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.createSettings(new List<User>{ new User(LanguageLocaleKey = 'ja', LocaleSidKey = 'en_GB') });
            Test.stopTest();
            Assert.areEqual('ja', result.language, '言語を保持する');
            Assert.areEqual('en_GB', result.locale, '現在の組み合わせを保持する');
            Assert.isTrue(result.languages.containsKey('en_US'), '英語を選べる');
            Assert.isTrue(result.locales.containsKey('ja_JP'), '日本を選べる');
            Assert.isTrue(result.canEdit, '管理者の更新権限を評価する');
        }

    }

    /** nullの取得結果を明示的な失敗にする */
    @IsTest
    static void rejectsNullRecords() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.createSettings(null);
            Test.stopTest();
            Assert.isFalse(result.canEdit, '未取得のまま編集できない');
            Assert.areEqual('言語・地域の設定を取得できませんでした。', result.errorMessage, '取得失敗を伝える');
        }

    }

    /** 空の取得結果を明示的な失敗にする */
    @IsTest
    static void rejectsEmptyRecords() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.createSettings(new List<User>());
            Test.stopTest();
            Assert.isFalse(result.canEdit, '対象なしでは編集できない');
            Assert.areEqual('言語・地域の設定を取得できませんでした。', result.errorMessage, '対象なしを通知する');
        }

    }

    /** 更新対象と項目を本人の設定に限定 */
    @IsTest
    static void buildsOnlyAllowedFields() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.prepareSave('ja', 'ja_JP');
            Test.stopTest();
            Assert.areEqual('', result.errorMessage, '有効な入力を受理する');
            Assert.areEqual(testUser.Id, result.record.Id, '本人に固定する');
            Assert.areEqual(new Set<String>{ 'Id', 'LanguageLocaleKey', 'LocaleSidKey' }, result.record.getPopulatedFieldsAsMap().keySet(), '許可した項目だけを更新する');
        }

    }

    /** 更新権限がなければレコードを生成しない */
    @IsTest
    static void rejectsMissingPermission() {
        UserLocaleSettingsWrapper options = new UserLocaleSettingsWrapper();

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.buildUpdate('ja', 'ja_JP', options);
            Test.stopTest();
            Assert.areEqual('言語・地域を変更する権限がありません。', result.errorMessage, '権限不足を通知する');
            Assert.isNull(result.record.Id, '更新対象を作らない');
        }

    }

    /** 未入力の言語を拒否 */
    @IsTest
    static void rejectsNullLanguage() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.prepareSave(null, 'ja_JP');
            Test.stopTest();
            Assert.areEqual('利用可能な言語を選択してください。', result.errorMessage, '言語を必須にする');
        }

    }

    /** 候補外の言語を拒否 */
    @IsTest
    static void rejectsUnknownLanguage() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.prepareSave('invalid', 'ja_JP');
            Test.stopTest();
            Assert.areEqual('利用可能な言語を選択してください。', result.errorMessage, '候補外の言語を拒否する');
        }

    }

    /** 未入力の地域を拒否 */
    @IsTest
    static void rejectsEmptyLocale() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.prepareSave('ja', '');
            Test.stopTest();
            Assert.areEqual('利用可能な地域を選択してください。', result.errorMessage, '地域を必須にする');
        }

    }

    /** 候補外の地域を拒否 */
    @IsTest
    static void rejectsUnknownLocale() {

        System.runAs(testUser) {
            Test.startTest();
            UserLocaleSettingsWrapper result = service.prepareSave('ja', 'invalid');
            Test.stopTest();
            Assert.areEqual('利用可能な地域を選択してください。', result.errorMessage, '候補外の地域を拒否する');
        }

    }
}