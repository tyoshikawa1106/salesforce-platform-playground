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
        createObjectMetricRecords();
        ObjectMetricsOverviewController.service = new ObjectMetricsOverviewService();
        ObjectMetricsOverviewController.queryCoordinator = new ObjectMetricsOverviewQueryCoordinator();

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
        ObjectMetricsOverviewItemWrapper accountMetric = getMetric(summary, 'accounts');
        ObjectMetricsOverviewItemWrapper contactMetric = getMetric(summary, 'contacts');
        ObjectMetricsOverviewItemWrapper leadMetric = getMetric(summary, 'leads');
        ObjectMetricsOverviewItemWrapper opportunityMetric = getMetric(
            summary,
            'opportunities'
        );
        ObjectMetricsOverviewItemWrapper productMetric = getMetric(summary, 'products');
        ObjectMetricsOverviewItemWrapper caseMetric = getMetric(summary, 'cases');
        Assert.areEqual(1, accountMetric.value, '作成済み Account を数える必要あり');
        Assert.areEqual(1, contactMetric.value, '作成済み Contact を数える必要あり');
        Assert.areEqual(1, leadMetric.value, '作成済み Lead を数える必要あり');
        Assert.areEqual(
            1,
            opportunityMetric.value,
            '作成済み Opportunity を数える必要あり'
        );
        Assert.areEqual(1, productMetric.value, '作成済み Product を数える必要あり');
        Assert.areEqual(1, caseMetric.value, '作成済み Case を数える必要あり');
    }

    /**
     * 集計取得に失敗した場合は画面向けエラーを返却
     */
    @IsTest
    static void shouldReturnUserFacingErrorWhenCoordinatorFails() {
        ObjectMetricsOverviewController.service = new ObjectMetricsOverviewService();
        ObjectMetricsOverviewController.queryCoordinator = new FailingObjectMetricsOverviewQueryCoordinator();

        System.runAs(testUser) {
            Test.startTest();

            try {
                // 件数取得例外を画面向け例外へ変換
                ObjectMetricsOverviewController.getObjectMetrics();
                Assert.fail('Coordinator の失敗は AuraHandledException に変換する必要あり');
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
     * サマリから指定キーのメトリクスを取得
     *
     * @param summary 検索対象のオブジェクト件数サマリ
     * @param metricKey 取得するメトリクスキー
     * @return 指定キーのメトリクス、存在しない場合は null
     */
    private static ObjectMetricsOverviewItemWrapper getMetric(
        ObjectMetricsOverviewSummaryWrapper summary,
        String metricKey
    ) {
        for (ObjectMetricsOverviewItemWrapper metric : summary.metrics) {
            if (metric.key == metricKey) {
                return metric;
            }
        }
        return null;
    }

    /**
     * 主要オブジェクトの実件数確認用レコードを作成
     */
    private static void createObjectMetricRecords() {
        Account accountRecord = TestDataFactory.createAccount(
            'Controller 件数取引先',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createContact(
            accountRecord,
            'Controller 件数責任者',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createLead(
            'Controller 件数リード',
            'Controller 件数会社',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createOpportunity(
            accountRecord,
            'Controller 件数商談',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createProduct(
            'Controller 件数商品',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createCase(
            'Controller 件数ケース',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
    }

    /**
     * 失敗用 Coordinator
     */
    private class FailingObjectMetricsOverviewQueryCoordinator extends ObjectMetricsOverviewQueryCoordinator {

        public override List<Integer> execute(
            List<ObjectMetricsOverviewService.CountQuery> countQueries
        ) {
            throw new FailingObjectMetricsOverviewException('想定外の Coordinator エラー');
        }
    }

    /**
     * 失敗用例外
     */
    private class FailingObjectMetricsOverviewException extends Exception {

    }
}
