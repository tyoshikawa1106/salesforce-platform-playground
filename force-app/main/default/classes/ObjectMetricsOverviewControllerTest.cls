/**
 * オブジェクト件数パネルのサマリをテストします。
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {
    @IsTest
    static void shouldReturnObjectMetricSummary() {
        ObjectMetricsOverviewController.service = new ObjectMetricsOverviewService();
        ObjectMetricsOverviewController.selector = new ObjectMetricsOverviewSelector();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            summary = ObjectMetricsOverviewController.getObjectMetrics();
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'All object metric cards should have a matching metric item.'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Controller should return the ordered service response.'
        );
    }

    @IsTest
    static void shouldReturnUserFacingErrorWhenSelectorFails() {
        ObjectMetricsOverviewController.service = new ObjectMetricsOverviewService();
        ObjectMetricsOverviewController.selector = new FailingObjectMetricsOverviewSelector();

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            try {
                ObjectMetricsOverviewController.getObjectMetrics();
                Assert.fail('Selector failures should be converted to AuraHandledException.');
            } catch (AuraHandledException error) {
                Assert.isNotNull(
                    error.getMessage(),
                    'Controller should throw a user-facing exception.'
                );
            }
            Test.stopTest();
        }
    }

    private class FailingObjectMetricsOverviewSelector extends ObjectMetricsOverviewSelector {
        public override Map<String, ObjectMetricCount> getObjectMetricValues() {
            throw new FailingObjectMetricsOverviewException(
                'Unexpected selector failure.'
            );
        }
    }

    private class FailingObjectMetricsOverviewException extends Exception {
    }
}
