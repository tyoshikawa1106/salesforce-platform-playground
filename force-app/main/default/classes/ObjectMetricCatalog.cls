/**
 * データボードで扱うオブジェクト定義を一元管理します。
 */
public with sharing class ObjectMetricCatalog {
    private static final List<MetricDefinition> ORDERED_DEFINITIONS = createOrderedDefinitions();
    private static final Map<String, MetricDefinition> DEFINITIONS_BY_KEY = createDefinitionsByKey();

    /**
     * 表示キー順に並べた定義を返します。
     * @return データボード表示順のオブジェクト定義
     */
    public static List<MetricDefinition> getDefinitions() {
        return new List<MetricDefinition>(ORDERED_DEFINITIONS);
    }

    /**
     * 表示キーに対応する定義を返します。
     * @param metricKey LWC から渡される表示キー
     * @return 表示キーに対応する定義。未定義の場合は null
     */
    public static MetricDefinition getDefinition(String metricKey) {
        if (String.isBlank(metricKey)) {
            return null;
        }

        return DEFINITIONS_BY_KEY.get(metricKey);
    }

    /**
     * 表示キーに対応する定義が存在するかを返します。
     * @param metricKey LWC から渡される表示キー
     * @return 対応定義が存在する場合 true
     */
    public static Boolean hasDefinition(String metricKey) {
        return getDefinition(metricKey) != null;
    }

    private static Map<String, MetricDefinition> createDefinitionsByKey() {
        Map<String, MetricDefinition> definitionsByKey = new Map<String, MetricDefinition>();

        for (MetricDefinition definition : ORDERED_DEFINITIONS) {
            definitionsByKey.put(definition.key, definition);
        }

        return definitionsByKey;
    }

    private static List<MetricDefinition> createOrderedDefinitions() {
        return new List<MetricDefinition>{
            new MetricDefinition('accounts', 'Account', '取引先'),
            new MetricDefinition('contacts', 'Contact', '取引先責任者'),
            new MetricDefinition('leads', 'Lead', 'リード'),
            new MetricDefinition('opportunities', 'Opportunity', '商談'),
            new MetricDefinition(
                'opportunityLineItems',
                'OpportunityLineItem',
                '商談商品'
            ),
            new MetricDefinition('products', 'Product2', '商品'),
            new MetricDefinition('pricebooks', 'Pricebook2', '価格表'),
            new MetricDefinition(
                'pricebookEntries',
                'PricebookEntry',
                '価格表エントリ'
            ),
            new MetricDefinition('assets', 'Asset', '納入商品'),
            new MetricDefinition('campaigns', 'Campaign', 'キャンペーン'),
            new MetricDefinition('cases', 'Case', 'ケース'),
            new MetricDefinition('contracts', 'Contract', '契約'),
            new MetricDefinition('orders', 'Order', '注文'),
            new MetricDefinition('orderItems', 'OrderItem', '注文商品'),
            new MetricDefinition(
                'entitlements',
                'Entitlement',
                'エンタイトルメント'
            ),
            new MetricDefinition(
                'serviceContracts',
                'ServiceContract',
                'サービス契約'
            ),
            new MetricDefinition('workOrders', 'WorkOrder', '作業指示'),
            new MetricDefinition(
                'workOrderLineItems',
                'WorkOrderLineItem',
                '作業指示品目'
            ),
            new MetricDefinition(
                'knowledgeArticles',
                'KnowledgeArticleVersion',
                'ナレッジ'
            ),
            new MetricDefinition('events', 'Event', '行動'),
            new MetricDefinition('tasks', 'Task', 'ToDo'),
            new MetricDefinition(
                'emailMessages',
                'EmailMessage',
                'メールメッセージ'
            ),
            new MetricDefinition(
                'emailTemplates',
                'EmailTemplate',
                'メールテンプレート'
            ),
            new MetricDefinition('reports', 'Report', 'レポート'),
            new MetricDefinition('dashboards', 'Dashboard', 'ダッシュボード'),
            new MetricDefinition('files', 'ContentDocument', 'ファイル'),
            new MetricDefinition('users', 'User', 'ユーザー')
        };
    }

    /**
     * データボードカードと対象オブジェクトを対応付ける定義です。
     */
    public class MetricDefinition {
        /**
         * LWC 側のカードキーです。
         */
        @AuraEnabled
        public String key { get; private set; }

        /**
         * 対象オブジェクト API 参照名です。
         */
        @AuraEnabled
        public String objectApiName { get; private set; }

        /**
         * 画面表示ラベルです。
         */
        @AuraEnabled
        public String label { get; private set; }

        private MetricDefinition(
            String key,
            String objectApiName,
            String label
        ) {
            this.key = key;
            this.objectApiName = objectApiName;
            this.label = label;
        }
    }
}
