/**
 * 汎用レコード検索画面の設定 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchConfigWrapperTest {
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

        System.runAs(TestDataFactory.currentUser()) {
            wrapper = new ObjectRecordSearchConfigWrapper(
                definition,
                nameFieldDescribe,
                objectDescribe
            )
                .withDisplayFields(displayFields, objectDescribe);
        }

        Assert.areEqual(
            'accounts',
            wrapper.metricKey,
            'Config wrapper should expose the metric key.'
        );
        Assert.areEqual(
            'Account',
            wrapper.objectApiName,
            'Config wrapper should expose the object API name.'
        );
        Assert.areEqual(
            nameFieldDescribe.getName(),
            wrapper.nameFieldApiName,
            'Config wrapper should expose the name field API name.'
        );
        Assert.areEqual(
            objectDescribe.isCreateable(),
            wrapper.createable,
            'Config wrapper should copy access flags.'
        );
        Assert.areEqual(
            'Industry',
            wrapper.displayFields[0].apiName,
            'Config wrapper should expose display fields.'
        );
        Assert.isTrue(
            wrapper.getAllowedFieldApiNames().contains('Industry'),
            'Config wrapper should expose allowed field API names for sorting.'
        );
    }
}
