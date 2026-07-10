/**
 * データボードで表示するオブジェクト件数サマリを組み立てます。
 */
public with sharing class ObjectMetricsOverviewService {
    /**
     * 表示順を固定したオブジェクト件数サマリを作成します。
     *
     * @param metricValues 表示キー別の件数。キーは ObjectMetricCatalog の定義キーと対応します。
     * @return カタログ定義順に整列したオブジェクト件数サマリ。
     */
    public ObjectMetricsOverviewSummaryWrapper createObjectMetrics(
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricValues
    ) {
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> safeMetricValues = metricValues ==
            null
            ? new Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount>()
            : metricValues;
        List<ObjectMetricsOverviewItemWrapper> metricItems = new List<ObjectMetricsOverviewItemWrapper>();

        for (
            ObjectMetricCatalog.MetricDefinition definition : ObjectMetricCatalog.getDefinitions()
        ) {
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
