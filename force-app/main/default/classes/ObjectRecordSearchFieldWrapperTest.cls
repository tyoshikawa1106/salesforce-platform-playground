/**
 * 汎用レコード検索画面の固定項目 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchFieldWrapperTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldExposeConstructorValues() {
        ObjectRecordSearchFieldWrapper wrapper;

        System.runAs(testUser) {
            wrapper = new ObjectRecordSearchFieldWrapper(
                'Industry',
                'Industry',
                'text'
            );
        }

        Assert.areEqual(
            'Industry',
            wrapper.apiName,
            'Field wrapper should expose the API name.'
        );
        Assert.areEqual(
            'Industry',
            wrapper.label,
            'Field wrapper should expose the label.'
        );
        Assert.areEqual(
            'text',
            wrapper.dataType,
            'Field wrapper should expose the datatable type.'
        );
    }
}