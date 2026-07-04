/**
 * オブジェクト件数サマリ Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectMetricsOverviewSummaryWrapperTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldKeepSuppliedMetricItems() {
        List<ObjectMetricsOverviewItemWrapper> items = new List<ObjectMetricsOverviewItemWrapper>{
            new ObjectMetricsOverviewItemWrapper(
                ObjectMetricCatalog.getDefinition('accounts'),
                ObjectMetricsOverviewSelector.createCount(1)
            )
        };

        ObjectMetricsOverviewSummaryWrapper wrapper;
        System.runAs(testUser) {
            Test.startTest();
            wrapper = new ObjectMetricsOverviewSummaryWrapper(items);
            Test.stopTest();
        }

        Assert.areEqual(1, wrapper.metrics.size(), 'Wrapper should expose supplied metric items.');
        Assert.areEqual('accounts', wrapper.metrics[0].key, 'Wrapper should keep item order.');
    }

    @IsTest
    static void shouldDefaultNullItemsToEmptyList() {
        ObjectMetricsOverviewSummaryWrapper wrapper;
        System.runAs(testUser) {
            Test.startTest();
            wrapper = new ObjectMetricsOverviewSummaryWrapper(null);
            Test.stopTest();
        }

        Assert.areEqual(0, wrapper.metrics.size(), 'Null metric items should become an empty list.');
    }
}