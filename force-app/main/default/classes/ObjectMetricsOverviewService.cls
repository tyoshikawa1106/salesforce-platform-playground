/**
 * データボードで表示するオブジェクト件数サマリを組み立てます。
 *
 * カタログ定義の表示順を基準に、Selector から取得した件数値を LWC 用の Wrapper へ変換します。
 */
public with sharing class ObjectMetricsOverviewService {
    /**
     * 表示順を固定したオブジェクト件数サマリを作成します。
     *
     * metricValues が null の場合、またはカタログ定義に対応する件数がない場合は、該当カードの件数を 0 として扱います。
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
