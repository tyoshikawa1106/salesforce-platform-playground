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

    /** 表示順・照会列・書き込み許可リストは暗号化項目を含まない */
    @IsTest
    static void excludesEncryptedUserFields() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, String> groups = catalog.getFieldGroups();
            Set<String> columns = new Set<String>(new UserCreateAssistantService().getQueryFields(catalog.orderedNames));
            Test.stopTest();
            Assert.isTrue(columns.contains('Username'), '通常のユーザー項目は引き続き取得');
            for (Schema.SObjectField token : User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap().values()) {
                Schema.DescribeFieldResult field = token.getDescribe();
                if (field.isEncrypted() || field.getType() == Schema.DisplayType.EncryptedString) {
                    Assert.isFalse(groups.containsKey(field.getName()), '入力項目から除外');
                    Assert.isFalse(catalog.orderedNames.contains(field.getName()), 'フォームの両列から除外');
                    Assert.isFalse(columns.contains(field.getName()), 'コピー元を読む SOQL から除外');
                }
            }
        }

    }

    /** 暗号化項目を直接指定した要求も項目への代入前に拒否する */
    @IsTest
    static void rejectsEncryptedFieldInputOnBothSides() {

        System.runAs(testUser) {
            String excludedName = 'UnavailableUserField';
            for (Schema.SObjectField token : User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap().values()) {
                Schema.DescribeFieldResult field = token.getDescribe();
                if (field.isEncrypted() || field.getType() == Schema.DisplayType.EncryptedString) {
                    excludedName = field.getName();
                    break;
                }
            }
            String payload = JSON.serialize(new Map<String, Object>{ excludedName => '入力検証' });
            Test.startTest();
            for (UserCreateAssistantFieldInput.Side side : UserCreateAssistantFieldInput.Side.values()) {
                User draft = new User();
                try {
                    new UserCreateAssistantFieldInput().applyChanges(draft, payload, side);
                    Assert.fail('フォーム対象外の項目指定を拒否');
                } catch (AuraHandledException expected) {
                    Assert.isFalse(draft.getPopulatedFieldsAsMap().containsKey(excludedName), '入力値が設定される前に拒否');
                }
            }
            Test.stopTest();
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
