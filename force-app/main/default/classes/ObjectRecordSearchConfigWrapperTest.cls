/**
 * 汎用レコード検索画面の設定 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchConfigWrapperTest {

    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldExposeMetricAndAccessValues() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Schema.DescribeFieldResult nameFieldDescribe = Account.Name.getDescribe();
        List<ObjectRecordSearchFieldWrapper> displayFields = new List<ObjectRecordSearchFieldWrapper>{
            new ObjectRecordSearchFieldWrapper('Industry', 'Industry', 'text')
        };
        ObjectRecordSearchConfigWrapper wrapper;

        System.runAs(testUser) {
            wrapper = new ObjectRecordSearchConfigWrapper(
                definition,
                nameFieldDescribe,
                objectDescribe
            )
                .withDisplayFields(displayFields);
        }

        Assert.areEqual(
            'accounts',
            wrapper.metricKey,
            'Config wrapper はメトリクスキーを公開する必要あり'
        );
        Assert.areEqual(
            'Account',
            wrapper.objectApiName,
            'Config wrapper はオブジェクト API 名を公開する必要あり'
        );
        Assert.areEqual(
            nameFieldDescribe.getName(),
            wrapper.nameFieldApiName,
            'Config wrapper は名前項目 API 名を公開する必要あり'
        );
        Assert.areEqual(
            objectDescribe.isCreateable(),
            wrapper.createable,
            'Config wrapper はアクセス可否を引き継ぐ必要あり'
        );
        Assert.areEqual(
            'Industry',
            wrapper.displayFields[0].apiName,
            'Config wrapper は表示項目を公開する必要あり'
        );
    }
}