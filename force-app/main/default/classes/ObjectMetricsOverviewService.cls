/**
 * オブジェクト件数一覧のサマリを組み立てます。
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
        'reports',
        'dashboards',
        'files',
        'users'
    };

    private final ObjectMetricsOverviewSelector selector;

    /**
     * 既定の Selector を使ってサービスを作成します。
     */
    public ObjectMetricsOverviewService() {
        this(new ObjectMetricsOverviewSelector());
    }

    /**
     * 指定された Selector を使ってサービスを作成します。
     * @param selector 件数値を取得する Selector
     */
    public ObjectMetricsOverviewService(
        ObjectMetricsOverviewSelector selector
    ) {
        this.selector = selector == null
            ? new ObjectMetricsOverviewSelector()
            : selector;
    }

    /**
     * 画面表示用に順序を固定した件数サマリを組み立てます。
     * @return 表示順に整列済みのオブジェクト件数サマリ
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
