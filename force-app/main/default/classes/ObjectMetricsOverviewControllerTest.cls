/**
 * オブジェクト件数パネルのサマリテスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldReturnObjectMetricSummary() {
        ObjectMetricsOverviewController.service = new ObjectMetricsOverviewService();
        ObjectMetricsOverviewController.selector = new ObjectMetricsOverviewSelector();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;
        System.runAs(testUser) {
            Test.startTest();

            // Controller 経由で画面用メトリクス一覧を組み立て
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

        System.runAs(testUser) {
            Test.startTest();

            try {
                // Selector 例外を画面向け例外へ変換
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

    /**
     * 失敗用 Selector
     */
    private class FailingObjectMetricsOverviewSelector extends ObjectMetricsOverviewSelector {
        public override Map<String, ObjectMetricCount> getObjectMetricValues() {
            throw new FailingObjectMetricsOverviewException(
                'Unexpected selector failure.'
            );
        }
    }

    /**
     * 失敗用例外
     */
    private class FailingObjectMetricsOverviewException extends Exception {
    }
}
