/**
 * オブジェクト件数一覧サービスの振る舞いをテストします。
 */
@IsTest
private with sharing class ObjectMetricsOverviewServiceTest {
    @IsTest
    static void shouldBuildOrderedSummaryFromMetricValues() {
        // 準備
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricValues = createMetricValues();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = service.createObjectMetrics(metricValues);
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'Service should return all configured metric items.'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Account metric should be first.'
        );
        Assert.areEqual(
            50000,
            summary.metrics[0].value,
            'Capped account value should be preserved.'
        );
        Assert.areEqual(
            'standard:account',
            summary.metrics[0].iconName,
            'Account metric should carry the card icon from the catalog.'
        );
        Assert.isTrue(
            summary.metrics[0].capped,
            'Capped account value should carry the capped marker.'
        );
        Assert.areEqual(
            'contacts',
            summary.metrics[1].key,
            'Contact metric should be second.'
        );
        Assert.areEqual(
            34,
            summary.metrics[1].value,
            'Contact value should come from the supplied metric values.'
        );
        Assert.isFalse(
            summary.metrics[1].capped,
            'Exact contact value should not carry the capped marker.'
        );
        Assert.areEqual(
            'leads',
            summary.metrics[2].key,
            'Lead metric should be third.'
        );
        Assert.areEqual(
            'users',
            summary.metrics[26].key,
            'User metric should be last.'
        );
    }

    @IsTest
    static void shouldReturnZeroValuesWhenMetricValuesAreNull() {
        // 準備
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = service.createObjectMetrics(null);
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'Service should return all configured metric items.'
        );
        Assert.areEqual(
            0,
            summary.metrics[0].value,
            'Missing metric values should default to zero.'
        );
        Assert.isFalse(
            summary.metrics[0].capped,
            'Missing metric values should not be capped.'
        );
    }

    private static Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> createMetricValues() {
        return new Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount>{
            'accounts' => ObjectMetricsOverviewSelector.createCount(50000),
            'contacts' => ObjectMetricsOverviewSelector.createCount(34)
        };
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
