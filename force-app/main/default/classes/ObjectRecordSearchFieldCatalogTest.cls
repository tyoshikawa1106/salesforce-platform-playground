/** 固定表示項目とDescribeに基づく表示契約のテスト */
@IsTest
private with sharing class ObjectRecordSearchFieldCatalogTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * Describeのソート可否を表示項目へ反映
     */
    @IsTest
    static void shouldExposeCatalogSortability() {
        List<ObjectRecordSearchFieldWrapper> fields;
        System.runAs(testUser) {
            Test.startTest();
            fields = ObjectRecordSearchFieldCatalog.getDisplayFields('Contact', Contact.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED));
            Test.stopTest();
        }
        Map<String, Boolean> sortableByField = new Map<String, Boolean>();
        for (ObjectRecordSearchFieldWrapper field : fields) {
            sortableByField.put(field.apiName, field.sortable);
        }
        Assert.areEqual(true, sortableByField.get('Email'), 'Email列はソート可能である必要あり');
        Assert.areEqual(false, sortableByField.get('Description'), '長文のDescription列はソート不可である必要あり');
    }

    /** 固定項目の順序と表示型を維持 */
    @IsTest
    static void preservesContactColumns() {
        System.runAs(testUser) {
            Test.startTest();
            List<ObjectRecordSearchFieldWrapper> fields = ObjectRecordSearchFieldCatalog.getDisplayFields('Contact', Contact.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED));
            Test.stopTest();
            Assert.areEqual(9, fields.size(), '取引先責任者の固定列をすべて返す');
            Assert.areEqual('Title', fields[0].apiName, '役職を先頭に表示');
            Assert.areEqual('Description', fields[8].apiName, '説明を末尾に表示');
            Assert.areEqual('email', fields[2].dataType, 'メール列にメール型を設定');
            Assert.areEqual('phone', fields[3].dataType, '電話列に電話型を設定');
            Assert.areEqual('text', fields[8].dataType, '長文をテキストとして表示');
        }
    }

    /** 未定義オブジェクトに固定列を追加しない */
    @IsTest
    static void returnsEmptyForUnknownObject() {
        System.runAs(testUser) {
            Test.startTest();
            List<ObjectRecordSearchFieldWrapper> fields = ObjectRecordSearchFieldCatalog.getDisplayFields('Unknown', Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED));
            Test.stopTest();
            Assert.areEqual(0, fields.size(), '未定義の対象には追加列なし');
        }
    }
}
