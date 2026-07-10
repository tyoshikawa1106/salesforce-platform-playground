/**
 * データボードで表示するオブジェクト件数サマリ組み立て
 */
public with sharing class ObjectMetricsOverviewService {
    /**
     * 表示順を固定したオブジェクト件数サマリを作成
     *
     * @param metricValues 表示キー別の件数、キーは ObjectMetricCatalog の定義キーと対応
     * @return カタログ定義順に整列したオブジェクト件数サマリ
     */
    public ObjectMetricsOverviewSummaryWrapper createObjectMetrics(
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricValues
    ) {
        // null 入力でも全カードをゼロ件で返せるよう空 Map に正規化
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> safeMetricValues = metricValues ==
            null
            ? new Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount>()
            : metricValues;
        List<ObjectMetricsOverviewItemWrapper> metricItems = new List<ObjectMetricsOverviewItemWrapper>();

        for (
            ObjectMetricCatalog.MetricDefinition definition : ObjectMetricCatalog.getDefinitions()
        ) {
            // カタログ定義順を保って画面表示用カードを組み立て
            metricItems.add(
                new ObjectMetricsOverviewItemWrapper(
                    definition,
                    safeMetricValues.get(definition.key)
                )
            );
        }

        return new ObjectMetricsOverviewSummaryWrapper(
            metricItems
        );
    }
}
