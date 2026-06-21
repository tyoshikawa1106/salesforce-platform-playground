/**
 * Builds object metric overview summaries.
 */
public with sharing class ObjectMetricsOverviewService {
    private static final List<String> METRIC_KEYS = new List<String>{
        'accounts',
        'contacts',
        'leads',
        'opportunities',
        'opportunityLineItems',
        'products',
        'pricebooks',
        'pricebookEntries',
        'assets',
        'campaigns',
        'cases',
        'contracts',
        'orders',
        'orderItems',
        'entitlements',
        'serviceContracts',
        'workOrders',
        'workOrderLineItems',
        'knowledgeArticles',
        'events',
        'tasks',
        'emailMessages',
        'emailTemplates',
        'processInstances',
        'processInstanceWorkitems',
        'processInstanceSteps',
        'users'
    };

    private final ObjectMetricsOverviewSelector selector;

    /**
     * Creates the service with the default selector.
     */
    public ObjectMetricsOverviewService() {
        this(new ObjectMetricsOverviewSelector());
    }

    /**
     * Creates the service with a supplied selector.
     * @param selector Selector used to retrieve metric values.
     */
    public ObjectMetricsOverviewService(
        ObjectMetricsOverviewSelector selector
    ) {
        this.selector = selector == null
            ? new ObjectMetricsOverviewSelector()
            : selector;
    }

    /**
     * Builds an ordered metric summary for display.
     * @return Ordered object metric summary.
     */
    public ObjectMetricsOverviewController.ObjectMetricSummary getObjectMetrics() {
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricValues = selector.getObjectMetricValues();
        List<ObjectMetricsOverviewController.ObjectMetricItem> metricItems = new List<ObjectMetricsOverviewController.ObjectMetricItem>();

        for (String key : METRIC_KEYS) {
            ObjectMetricsOverviewSelector.ObjectMetricCount metricCount = metricValues.get(
                key
            );
            metricItems.add(
                new ObjectMetricsOverviewController.ObjectMetricItem(
                    key,
                    metricCount
                )
            );
        }

        return new ObjectMetricsOverviewController.ObjectMetricSummary(
            metricItems
        );
    }
}
