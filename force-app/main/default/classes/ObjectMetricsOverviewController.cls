/**
 * Supplies object metric summaries for the object metrics panel Lightning Web Component.
 */
public with sharing class ObjectMetricsOverviewController {
    /**
     * Counts object records visible to the current user.
     * @return Ordered record count summary for the LWC.
     */
    @AuraEnabled(cacheable=true)
    public static ObjectMetricSummary getObjectMetrics() {
        try {
            return new ObjectMetricsOverviewService().getObjectMetrics();
        } catch (Exception error) {
            throw new AuraHandledException(
                'オブジェクト指標を読み込めませんでした。'
            );
        }
    }

    /**
     * Response DTO for object metric results.
     */
    public class ObjectMetricSummary {
        /**
         * Ordered metric items displayed by the LWC.
         */
        @AuraEnabled
        public List<ObjectMetricItem> metrics { get; private set; }

        /**
         * Creates a summary with ordered metrics.
         * @param metrics Ordered metric items.
         */
        public ObjectMetricSummary(List<ObjectMetricItem> metrics) {
            this.metrics = metrics;
        }
    }

    /**
     * Single object metric item.
     */
    public class ObjectMetricItem {
        /**
         * Stable card key used by the LWC display configuration.
         */
        @AuraEnabled
        public String key { get; private set; }

        /**
         * Metric value for the key.
         */
        @AuraEnabled
        public Integer value { get; private set; }

        /**
         * Whether the metric reached the display limit.
         */
        @AuraEnabled
        public Boolean capped { get; private set; }

        /**
         * Creates a metric item.
         * @param key Stable metric key.
         * @param metricCount Count result with display limit metadata.
         */
        public ObjectMetricItem(
            String key,
            ObjectMetricsOverviewSelector.ObjectMetricCount metricCount
        ) {
            this.key = key;
            this.value = metricCount?.value ?? 0;
            this.capped = metricCount?.capped ?? false;
        }
    }
}
