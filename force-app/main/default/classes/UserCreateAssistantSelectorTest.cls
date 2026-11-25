/** コピー元と有効な割り当ての照会範囲の検証 */
@IsTest
private with sharing class UserCreateAssistantSelectorTest {

    private static UserCreateAssistantSelector selector = new UserCreateAssistantSelector();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 表示項目と保存に必要な固定項目を同じユーザーから取得 */
    @IsTest
    static void loadsSelectedUserForDisplayAndSave() {

        System.runAs(testUser) {
            Test.startTest();
            List<User> display = selector.getUsers(testUser.Id, new List<String>{ 'Id', 'Username' });
            List<User> saveSource = selector.getSourceForSave(testUser.Id);
            Test.stopTest();
            Assert.areEqual(1, display.size(), '選択したユーザーだけを表示');
            Assert.areEqual(UserInfo.getUserName(), display[0].Username, '表示に必要な項目を取得');
            Assert.areEqual(1, saveSource.size(), '固定項目を読み込むユーザーは1人');
            Assert.areEqual(testUser.Id, saveSource[0].Id, '保存要求と同じユーザーを取得');
            Assert.areEqual(UserInfo.getProfileId(), saveSource[0].ProfileId, '保存に必要なプロファイルを取得');
        }

    }

    /** ユーザー未選択・参照項目未指定では不要な照会を行わない */
    @IsTest
    static void skipsQueriesForMissingConditions() {

        System.runAs(testUser) {
            Test.startTest();
            Assert.isTrue(selector.getUsers(null, new List<String>{ 'Id' }).isEmpty(), '未選択は表示対象なし');
            Assert.isTrue(selector.getUsers(testUser.Id, new List<String>()).isEmpty(), '表示項目なしで照会しない');
            Assert.isTrue(selector.getSourceForSave(null).isEmpty(), 'コピー元未指定は保存対象なし');
            Assert.isTrue(selector.getAssignments(null).isEmpty(), 'ユーザー未指定は引継対象なし');
            Assert.areEqual(0, Limits.getQueries(), '対象条件が欠けた場合は全件照会しない');
            Test.stopTest();
        }

    }

    /** 元ユーザーの直接割り当てだけを取得 */
    @IsTest
    static void selectsOnlyAssignmentsOfSourceUser() {

        System.runAs(testUser) {
            User source = new User(
                ProfileId = UserInfo.getProfileId(), Alias = 'ucatest', LastName = '割り当て照会元',
                Email = 'owner@example.invalid', Username = EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
                TimeZoneSidKey = 'Asia/Tokyo', LocaleSidKey = UserInfo.getLocale(),
                LanguageLocaleKey = UserInfo.getLanguage(), EmailEncodingKey = 'UTF-8'
            );
            insert source;
            PermissionSet direct = new PermissionSet(Name = 'UserCreateSelectorDirect', Label = '照会試験');
            insert direct;
            insert new PermissionSetAssignment(AssigneeId = source.Id, PermissionSetId = direct.Id);
            Test.startTest();
            List<PermissionSetAssignment> assigned = selector.getAssignments(source.Id);
            Test.stopTest();
            Assert.areEqual(1, assigned.size(), 'プロファイル由来の割り当てを除外する');
            Assert.areEqual(direct.Id, assigned[0].PermissionSetId, '指定したユーザーの権限セットを取得');
        }

    }
}
