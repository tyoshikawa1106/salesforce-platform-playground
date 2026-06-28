/**
 * 汎用レコード検索の内部処理 Context をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchContextTest {
    @IsTest
    static void shouldCreateConfigAndAllowedFields() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        List<ObjectRecordSearchFieldWrapper> displayFields = new List<ObjectRecordSearchFieldWrapper>{
            new ObjectRecordSearchFieldWrapper('Industry', 'Industry', 'text')
        };

        ObjectRecordSearchContext context;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            context = new ObjectRecordSearchContext(
                new ObjectRecordSearchConfigWrapper(
                        definition,
                        Account.Name.getDescribe(),
                        objectDescribe
                    )
                    .withDisplayFields(displayFields),
                Account.Name.getDescribe(),
                objectDescribe
            );
            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            context.config.metricKey,
            'Context should expose the LWC config wrapper.'
        );
        Assert.isTrue(
            context.getAllowedFieldApiNames().contains('Industry'),
            'Context should allow configured display fields for sorting.'
        );
        Assert.areEqual(
            Schema.DisplayType.PICKLIST,
            context.getAllowedFieldDescribe('Industry').getType(),
            'Context should keep field describe values for cursor parsing.'
        );
    }
}
