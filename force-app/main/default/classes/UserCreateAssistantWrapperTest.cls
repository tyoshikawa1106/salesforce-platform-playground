/** ユーザー作成フォームの初期状態の検証 */
@IsTest
private with sharing class UserCreateAssistantWrapperTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** ユーザー未取得の表示項目は空で初期化 */
    @IsTest
    static void initializesEmptyFields() {

        System.runAs(testUser) {
            Test.startTest();
            UserCreateAssistantWrapper form = new UserCreateAssistantWrapper();
            Test.stopTest();
            Assert.isFalse(form.deactivateSource, '初期状態はコピー元を参照のみにする');
            Assert.isTrue(form.copyPermissionSets, '直接の割り当て引き継ぎは初期状態でオン');
            Assert.isTrue(form.copyPermissionSetGroups, 'グループの引き継ぎは初期状態でオン');
            Assert.isTrue(form.fields.isEmpty(), 'ユーザーを選んで取得するまでは表示項目を持たない');
        }

    }
}