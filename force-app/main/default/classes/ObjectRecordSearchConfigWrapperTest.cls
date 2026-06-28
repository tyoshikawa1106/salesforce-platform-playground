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
        Schema.DescribeFieldResult nameFieldDescribe = Account.Name.getDescribe();
        ObjectRecordSearchAccessWrapper access = new ObjectRecordSearchAccessWrapper(
            Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
            new List<ObjectRecordSearchFieldWrapper>{
                new ObjectRecordSearchFieldWrapper('Industry', 'Industry', 'text')
            }
        );
        ObjectRecordSearchConfigWrapper wrapper;

        System.runAs(getCurrentUser()) {
            wrapper = new ObjectRecordSearchConfigWrapper(
                definition,
                nameFieldDescribe,
                access
            );
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
            access.createable,
            wrapper.createable,
            'Config wrapper should copy access flags.'
        );
        Assert.areEqual(
            'Industry',
            wrapper.displayFields[0].apiName,
            'Config wrapper should expose display fields.'
        );
    }

    private static User getCurrentUser() {
        return [SELECT Id FROM User WHERE Id = :UserInfo.getUserId()];
    }
}
