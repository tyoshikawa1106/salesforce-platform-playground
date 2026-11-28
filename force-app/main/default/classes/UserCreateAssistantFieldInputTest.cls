/** ユーザー画面の入力型と書き込み制限の検証 */
@IsTest
private with sharing class UserCreateAssistantFieldInputTest {

    private static UserCreateAssistantFieldInput input = new UserCreateAssistantFieldInput();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** クライアントからの固定項目の書き換え要求を拒否 */
    @IsTest
    static void rejectsClientProvidedProfile() {
        User source = new User(Id = testUser.Id, ProfileId = UserInfo.getProfileId());
        String changes = JSON.serialize(new Map<String, Object>{
            'ProfileId' => UserInfo.getProfileId(), 'IsActive' => true, 'Alias' => 'ucatest',
            'LastName' => '固定項目試験', 'Username' => 'draft@example.com', 'Email' => 'draft@example.com',
            'TimeZoneSidKey' => 'Asia/Tokyo', 'LocaleSidKey' => UserInfo.getLocale(),
            'LanguageLocaleKey' => UserInfo.getLanguage(), 'EmailEncodingKey' => 'UTF-8'
        });

        System.runAs(testUser) {
            Test.startTest();
            try {
                input.applyChanges(source, changes, UserCreateAssistantFieldInput.Side.TARGET);
                Assert.fail('新規側のプロファイルはサーバーが決定する');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), '固定項目の指定を拒否する');
            }
            Test.stopTest();
        }

    }

    /** 個別検証でもフォーム外の項目や表記違いの項目名は保存対象にしない */
    @IsTest
    static void rejectsUndisplayedAndNoncanonicalFields() {
        System.runAs(testUser) {
            Test.startTest();
            for (String name : new List<String>{ 'ContactId', 'UserLicenseId', 'lastname', 'UnknownUserField__c' }) {
                User draft = new User();
                try {
                    input.applyChanges(draft, JSON.serialize(new Map<String,Object>{name => null}), UserCreateAssistantFieldInput.Side.SOURCE);
                    Assert.fail('受付対象外の項目を拒否');
                } catch (AuraHandledException expected) {
                    Assert.isTrue(draft.getPopulatedFieldsAsMap().isEmpty(), '対象外の項目を適用しない');
                }
            }
            Test.stopTest();
        }
    }

    /** 参照モードの要求に含まれたコピー元変更を拒否 */
    @IsTest
    static void rejectsSourceChangesWithoutDeactivation() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                input.checkSourceUnchanged('{"Email":"change@example.com"}');
                Assert.fail('無効化を選ばない場合は元ユーザーの編集不可');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), 'モードと矛盾する入力を拒否');
            }
            Test.stopTest();
        }

    }

    /** すべての入力が空なら、新規ユーザーの必須値を拒否 */
    @IsTest
    static void rejectsMissingRequiredInput() {
        User source = new User(Id = testUser.Id, ProfileId = UserInfo.getProfileId());

        System.runAs(testUser) {
            Test.startTest();
            try {
                input.applyChanges(source, '{}', UserCreateAssistantFieldInput.Side.TARGET);
                Assert.fail('必須項目を入力するまでは新規作成できない');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), '未入力項目を通知');
            }
            Test.stopTest();
        }

    }

    /** 整数と小数を Salesforce 項目の精度で扱う */
    @IsTest
    static void convertsNumericInputs() {

        System.runAs(testUser) {
            Test.startTest();
            Object employees = input.convertValue(Account.NumberOfEmployees.getDescribe(), '12');
            Object revenue = input.convertValue(Account.AnnualRevenue.getDescribe(), '12345.67');
            Test.stopTest();
            Assert.areEqual(12, employees, '整数項目の数値を変換');
            Assert.areEqual(Decimal.valueOf('12345.67'), revenue, '金額項目の小数を保持');
        }

    }

    /** 日付・日時・時刻の精度とタイムゾーンを維持 */
    @IsTest
    static void convertsDateAndTimeInputs() {

        System.runAs(testUser) {
            Test.startTest();
            Object day = input.convertValue(Opportunity.CloseDate.getDescribe(), '2025-01-15');
            Object instant = input.convertValue(User.CreatedDate.getDescribe(), '2025-01-15T05:30:42.000Z');
            Object clock = input.convertValue(BusinessHours.MondayStartTime.getDescribe(), '14:30:42.123Z');
            Test.stopTest();
            Assert.areEqual(Date.newInstance(2025, 1, 15), day, '日付はタイムゾーンでずらさない');
            Assert.areEqual(Datetime.newInstanceGMT(2025, 1, 15, 5, 30, 42), instant, '日時は UTC として解釈');
            Assert.areEqual(Time.newInstance(14, 30, 42, 123), clock, '時刻のミリ秒を保持');
        }

    }

    /** 時刻の範囲・形式が不正な入力を保存対象から除外 */
    @IsTest
    static void rejectsMalformedTime() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                input.convertValue(BusinessHours.MondayStartTime.getDescribe(), 'not-a-time');
                Assert.fail('不正な時刻の保存を拒否');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), '時刻の修正を通知');
            }
            Test.stopTest();
        }

    }

    /** コピー元で編集した文字列・参照値・項目クリアを適用 */
    @IsTest
    static void appliesSourceValuesAndExplicitClear() {
        User record = new User(Department = '変更前', LastName = '元の姓');
        String changes = JSON.serialize(new Map<String, Object>{ 'Department' => '', 'LastName' => '変更後', 'ManagerId' => testUser.Id });

        System.runAs(testUser) {
            Test.startTest();
            input.applyChanges(record, changes, UserCreateAssistantFieldInput.Side.SOURCE);
            Test.stopTest();
            Assert.isNull(record.Department, '空欄にした項目をクリア');
            Assert.areEqual('変更後', record.LastName, '指定された文字列項目を更新');
            Assert.areEqual(testUser.Id, record.ManagerId, '参照先ユーザーを ID として保持');
        }

    }
}