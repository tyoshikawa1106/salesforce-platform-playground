/**
 * オブジェクト件数カード Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectMetricsOverviewItemWrapperTest {
    @IsTest
    static void shouldCreateItemFromDefinitionAndMetricCount() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );

        ObjectMetricsOverviewItemWrapper wrapper;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            wrapper = new ObjectMetricsOverviewItemWrapper(
                definition,
                ObjectMetricsOverviewSelector.createCount(50000)
            );
            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            wrapper.key,
            'Wrapper should expose the metric key.'
        );
        Assert.areEqual(
            'Account',
            wrapper.objectApiName,
            'Wrapper should expose the object API name.'
        );
        Assert.areEqual(
            '取引先',
            wrapper.label,
            'Wrapper should expose the display label.'
        );
        Assert.areEqual(
            'standard:account',
            wrapper.iconName,
            'Wrapper should expose the icon name.'
        );
        Assert.areEqual(
            50000,
            wrapper.value,
            'Wrapper should expose the metric value.'
        );
        Assert.isTrue(
            wrapper.capped,
            'Wrapper should expose the capped marker.'
        );
    }

    @IsTest
    static void shouldDefaultMissingMetricCountToZero() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'contacts'
        );

        ObjectMetricsOverviewItemWrapper wrapper;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            wrapper = new ObjectMetricsOverviewItemWrapper(definition, null);
            Test.stopTest();
        }

        Assert.areEqual(
            0,
            wrapper.value,
            'Missing metric counts should default to zero.'
        );
        Assert.isFalse(
            wrapper.capped,
            'Missing metric counts should not be capped.'
        );
    }
}