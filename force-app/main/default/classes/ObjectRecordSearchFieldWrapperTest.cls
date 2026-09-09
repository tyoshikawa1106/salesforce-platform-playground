/**
 * 汎用レコード検索画面の固定項目 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchFieldWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 明示されたソート可否を公開
     */
    @IsTest
    static void shouldExposeSortability() {
        ObjectRecordSearchFieldWrapper wrapper;
        System.runAs(testUser) {
            Test.startTest();
            wrapper = new ObjectRecordSearchFieldWrapper(Contact.Email.getDescribe(), 'email');
            Test.stopTest();
        }
        Assert.isTrue(wrapper.sortable, 'ソート可能な列を画面へ公開する必要あり');
    }

    /**
     * nullのソート可否は操作不可として公開
     */
    @IsTest
    static void shouldNormalizeNullSortability() {
        ObjectRecordSearchFieldWrapper wrapper;
        System.runAs(testUser) {
            Test.startTest();
            wrapper = new ObjectRecordSearchFieldWrapper(null, 'text');
            Test.stopTest();
        }
        Assert.isFalse(wrapper.sortable, '未指定のソート操作を許可しない必要あり');
    }

    /**
     * Describeのソート可否を表示項目へ反映
     */
    @IsTest
    static void shouldExposeCatalogSortability() {
        List<ObjectRecordSearchFieldWrapper> fields;
        System.runAs(testUser) {
            Test.startTest();
            fields = ObjectRecordSearchDisplayFieldCatalog.getDisplayFields('Contact', Contact.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED));
            Test.stopTest();
        }
        Map<String, Boolean> sortableByField = new Map<String, Boolean>();
        for (ObjectRecordSearchFieldWrapper field : fields) {
            sortableByField.put(field.apiName, field.sortable);
        }
        Assert.areEqual(true, sortableByField.get('Email'), 'Email列はソート可能である必要あり');
        Assert.areEqual(false, sortableByField.get('Description'), '長文のDescription列はソート不可である必要あり');
    }

    /**
     * コンストラクタで受け取った値を公開
     */
    @IsTest
    static void shouldExposeConstructorValues() {
        ObjectRecordSearchFieldWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchFieldWrapper(
                'Industry',
                'Industry',
                'text'
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Industry',
            wrapper.apiName,
            'Field wrapper は API 名を公開する必要あり'
        );
        Assert.areEqual(
            'Industry',
            wrapper.label,
            'Field wrapper はラベルを公開する必要あり'
        );
        Assert.areEqual(
            'text',
            wrapper.dataType,
            'Field wrapper はデータテーブル型を公開する必要あり'
        );
    }

    /**
     * null の表示項目値を空文字列へ変換
     */
    @IsTest
    static void shouldNormalizeNullConstructorValues() {
        ObjectRecordSearchFieldWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchFieldWrapper(null, null, null);

            Test.stopTest();
        }

        Assert.areEqual('', wrapper.apiName, 'null の API 名は空文字列へ変換する必要あり');
        Assert.areEqual('', wrapper.label, 'null のラベルは空文字列へ変換する必要あり');
        Assert.areEqual('', wrapper.dataType, 'null の表示型は空文字列へ変換する必要あり');
    }
}