/**
 * オブジェクト件数一覧サービスの振る舞いをテストします。
 */
@IsTest
private with sharing class ObjectMetricsOverviewServiceTest {
    @IsTest
    static void shouldBuildOrderedSummaryFromSelectorValues() {
        // 準備
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService(
            new StubObjectMetricsOverviewSelector()
        );

        // 実行
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = service.getObjectMetrics();
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
            'Contact value should come from the selector.'
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
    static void shouldUseDefaultSelectorWhenSelectorIsNull() {
        // 準備
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService(
            null
        );

        // 実行
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = service.getObjectMetrics();
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'Service should fall back to the default selector.'
        );
    }

    private class StubObjectMetricsOverviewSelector extends ObjectMetricsOverviewSelector {
        public override Map<String, ObjectMetricCount> getObjectMetricValues() {
            return new Map<String, ObjectMetricCount>{
                'accounts' => ObjectMetricsOverviewSelector.createCount(50000),
                'contacts' => ObjectMetricsOverviewSelector.createCount(34)
            };
        }
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}