/**
 * オブジェクト件数パネルのサマリテスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * オブジェクト件数サマリーを画面用に返却
     */
    @IsTest
    static void shouldReturnObjectMetricSummary() {
        insert new Account(Name = 'Controller 件数取引先');

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
        Assert.areEqual(1, accountMetric.value, '作成済み Account を数える必要あり');
        Assert.areEqual(0, contactMetric.value, '未作成の Contact は0件を返す必要あり');
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

}