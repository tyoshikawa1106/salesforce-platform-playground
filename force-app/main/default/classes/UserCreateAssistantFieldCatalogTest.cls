/** ユーザー作成画面の標準項目・入出力条件の検証 */
@IsTest
private with sharing class UserCreateAssistantFieldCatalogTest {

    private static UserCreateAssistantFieldCatalog catalog = new UserCreateAssistantFieldCatalog();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 標準画面に対応する項目と固定のライセンスを返す */
    @IsTest
    static void groupsStandardUserFields() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, String> groups = catalog.getFieldGroups();
            Test.stopTest();
            Assert.areEqual('ユーザー情報', groups.get('Username'), 'ユーザー名を基本情報に表示');
            Assert.areEqual(groups.get('ProfileId'), groups.get('UserLicenseId'), 'プロファイルとライセンスを同じ区分に表示');
            Assert.areEqual('地域の設定', groups.get('TimeZoneSidKey'), '地域関連の項目をまとめる');
            Assert.isFalse(groups.containsKey('Id'), 'レコード ID はフォーム項目に含めない');
        }

    }

    /** 固定項目と参照先・任意の標準項目の編集条件を識別 */
    @IsTest
    static void describesInputKindsAndRequiredFields() {

        System.runAs(testUser) {
            Test.startTest();
            Schema.DescribeFieldResult profile = UserCreateAssistantFieldCatalog.getUserField('ProfileId');
            String fixedType = UserCreateAssistantFieldCatalog.getInputType(profile);
            String referenceType = UserCreateAssistantFieldCatalog.getInputType(User.ManagerId.getDescribe());
            Boolean mustSelectActive = UserCreateAssistantFieldCatalog.isRequired(User.IsActive.getDescribe());
            Boolean needsPhone = UserCreateAssistantFieldCatalog.isRequired(User.Phone.getDescribe());
            Test.stopTest();
            Assert.areEqual('readonly', fixedType, 'プロファイルは固定');
            Assert.areEqual('reference', referenceType, '上司はユーザーを参照');
            Assert.isTrue(mustSelectActive, '有効状態は新規側で選択する');
            Assert.isFalse(needsPhone, '任意の標準項目を必須にしない');
        }

    }
}
