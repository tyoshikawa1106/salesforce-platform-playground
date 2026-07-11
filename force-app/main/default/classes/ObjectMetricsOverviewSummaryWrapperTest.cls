/**
 * オブジェクト件数サマリ Wrapper テスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewSummaryWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 指定されたメトリクス行をサマリーに保持
     */
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

        Assert.areEqual(1, wrapper.metrics.size(), 'Wrapper は指定されたメトリクス項目を公開する必要あり');
        Assert.areEqual('accounts', wrapper.metrics[0].key, 'Wrapper は項目の並び順を保つ必要あり');
    }

    /**
     * null のメトリクス行は空リストに初期化
     */
    @IsTest
    static void shouldDefaultNullItemsToEmptyList() {
        ObjectMetricsOverviewSummaryWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectMetricsOverviewSummaryWrapper(null);

            Test.stopTest();
        }

        Assert.areEqual(0, wrapper.metrics.size(), 'null のメトリクス項目は空リストにする必要あり');
    }
}
