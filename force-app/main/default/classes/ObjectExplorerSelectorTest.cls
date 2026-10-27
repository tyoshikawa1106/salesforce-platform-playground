/** 項目定義・所有者の取得範囲 */
@IsTest
private with sharing class ObjectExplorerSelectorTest {
    private static ObjectExplorerSelector selector = new ObjectExplorerSelector();

    private static User testUser = TestDataFactory.getTestUser();

    /** 必須条件なしで照会しない */
    @IsTest
    static void emptyConditionsDoNotQuery() {
        System.runAs(testUser) {
            Test.startTest();
            Integer beforeQueries = Limits.getQueries();
            Assert.isTrue(selector.selectFields(null).isEmpty(), '対象なしは分類を取得しない');
            Assert.isTrue(selector.selectFieldTypes('').isEmpty(), '対象なしは型を取得しない');
            Assert.isTrue(selector.selectFieldAuditTargets(' ').isEmpty(), '空白は日時対象を取得しない');
            Assert.isTrue(selector.selectFieldsByNames('Account', new Set<String>()).isEmpty(), '項目なしは取得しない');
            Assert.isTrue(
                selector.selectFieldsByNames(null, new Set<String>{ 'Name' }).isEmpty(),
                '対象なしは取得しない'
            );
            Assert.isTrue(selector.selectOwnerUsers(null).isEmpty(), '所有者未指定はユーザー取得しない');
            Assert.isTrue(selector.selectOwnerGroups(new Set<Id>()).isEmpty(), '所有者未指定はグループ取得しない');
            Assert.isTrue(selector.selectAuditUsers(new Set<Id>()).isEmpty(), '日時ユーザー未指定は取得しない');
            Assert.areEqual(beforeQueries, Limits.getQueries(), '必須条件なしでSOQLを実行しない');
            Test.stopTest();
        }
    }
    /** 対象定義とユーザーIDを限定して照会 */
    @IsTest
    static void selectsOnlyRequestedDefinitions() {
        System.runAs(testUser) {
            Test.startTest();
            List<FieldDefinition> records = selector.selectFieldsByNames(
                'Account',
                new Set<String>{ 'Name', 'AccountNumber' }
            );
            Set<String> names = new Set<String>();
            for (FieldDefinition record : records) {
                names.add(record.QualifiedApiName);
            }
            Assert.areEqual(new Set<String>{ 'Name', 'AccountNumber' }, names, '要求した定義だけを取得');
            Assert.isFalse(selector.selectFieldTypes('Account').isEmpty(), '型を取得');
            Assert.isFalse(selector.selectFields('Account').isEmpty(), '分類を取得');
            Assert.isFalse(selector.selectFieldAuditTargets('Account').isEmpty(), '項目識別情報を取得');
            Assert.areEqual(1, selector.selectAuditUsers(new Set<Id>{ testUser.Id }).size(), '指定ユーザーだけ取得');
            Assert.areEqual(1, selector.selectOwnerUsers(new Set<Id>{ testUser.Id }).size(), '同じIDの所有者だけ取得');
            Assert.areEqual(1, selector.selectCurrentPermissions().size(), '実効権限を取得');
            Test.stopTest();
        }
    }
    /** 所有者候補からキューを除外 */
    @IsTest
    static void excludesQueuesFromOwnerGroups() {
        System.runAs(testUser) {
            Test.startTest();
            Group groupRecord = new Group(
                Name = 'Explorer Public Group',
                DeveloperName = 'ExplorerPublicGroup',
                Type = 'Regular'
            );
            Group queue = new Group(Name = 'Explorer Queue', DeveloperName = 'ExplorerQueue', Type = 'Queue');
            insert new List<Group>{ groupRecord, queue };
            List<Group> groups = selector.selectOwnerGroups(new Set<Id>{ groupRecord.Id, queue.Id });
            Assert.areEqual(1, groups.size(), '公開グループだけを取得');
            Assert.areEqual(groupRecord.Id, groups[0].Id, 'キューを所有者候補へ含めない');
            Assert.areEqual(1, selector.selectGroups('Explorer Public').size(), '名前で公開グループを検索');
            Assert.isTrue(selector.selectUsers('NoSuchExplorerUserXYZ').isEmpty(), '未一致のユーザーは空');
            Test.stopTest();
        }
    }
}
