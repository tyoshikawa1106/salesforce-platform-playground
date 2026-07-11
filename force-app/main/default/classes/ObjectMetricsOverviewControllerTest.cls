/**
 * オブジェクト件数パネルのサマリテスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * オブジェクト件数サマリーを画面用に返却
     */
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
            'すべてのメトリクスカードに対応する項目が必要'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Controller は Service の並び順を保って返す必要あり'
        );
    }

    /**
     * 集計取得に失敗した場合は画面向けエラーを返却
     */
    @IsTest
    static void shouldReturnUserFacingErrorWhenSelectorFails() {
        ObjectMetricsOverviewController.service = new ObjectMetricsOverviewService();
        ObjectMetricsOverviewController.selector = new FailingObjectMetricsOverviewSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                // 件数取得例外を画面向け例外へ変換
                ObjectMetricsOverviewController.getObjectMetrics();
                Assert.fail('Selector の失敗は AuraHandledException に変換する必要あり');
            } catch (AuraHandledException e) {
                Assert.isNotNull(
                    e.getMessage(),
                    'Controller はユーザー向け例外を返す必要あり'
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
            throw new FailingObjectMetricsOverviewException('想定外の Selector エラー');
        }
    }

    /**
     * 失敗用例外
     */
    private class FailingObjectMetricsOverviewException extends Exception {

    }
}