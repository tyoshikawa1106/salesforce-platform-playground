/**
 * オブジェクト件数一覧のサマリを組み立てます。
 */
public with sharing class ObjectMetricsOverviewService {
    /**
     * 画面表示用に順序を固定した件数サマリを組み立てます。
     * @param metricValues 表示キー別の件数
     * @return 表示順に整列済みのオブジェクト件数サマリ
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