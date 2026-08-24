/**
 * データボード LWC に表示するレコード件数サマリ提供
 */
public with sharing class ObjectMetricsOverviewController {

    @TestVisible
    private static ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
    @TestVisible
    private static ObjectMetricsOverviewQueryCoordinator queryCoordinator = new ObjectMetricsOverviewQueryCoordinator();

    /**
     * 現在のユーザーが参照できる各オブジェクトの件数取得
     *
     * @return LWC 表示順に整列済みのレコード件数サマリ
     */
    @AuraEnabled(cacheable=true)
    public static ObjectMetricsOverviewSummaryWrapper getObjectMetrics() {
        try {
            // 画面表示順の固定カタログを取得
            List<ObjectMetricCatalog.MetricDefinition> definitions = ObjectMetricCatalog.getDefinitions();
            // 固定カタログから権限確認済みの件数取得計画を作成
            List<ObjectMetricsOverviewService.CountQuery> countQueries = service.createCountQueries(definitions);
            // 専用 Coordinator で異なる SObject の件数取得を実行
            List<Integer> visibleRecordCounts = queryCoordinator.execute(countQueries);
            // 未加工の取得結果を表示上限付きのメトリクス値へ集計
            Map<String, ObjectMetricsOverviewService.ObjectMetricCount> metricValues = service.createMetricValues(
                countQueries,
                visibleRecordCounts
            );
            // 件数結果を画面表示順のサマリへ変換
            ObjectMetricsOverviewSummaryWrapper summary = service.createObjectMetrics(metricValues);
            // LWC へカタログ順の件数サマリを返却
            return summary;
        } catch (Exception e) {
            throw new AuraHandledException('データボードを表示できませんでした。時間をおいてもう一度お試しください。');
        }
    }
}