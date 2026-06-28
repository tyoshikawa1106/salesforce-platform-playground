/**
 * データボードで扱うオブジェクト定義を一元管理します。
 */
public with sharing class ObjectMetricCatalog {
    private static final List<MetricDefinition> ORDERED_DEFINITIONS = createOrderedDefinitions();
    private static final Map<String, MetricDefinition> DEFINITIONS_BY_KEY = createDefinitionsByKey();
    private static final Set<String> OBJECT_API_NAMES = createObjectApiNames();

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

    /**
     * 対象オブジェクト API 参照名がデータボード定義に含まれるかを返します。
     * @param objectApiName 対象オブジェクト API 参照名
     * @return 定義済みオブジェクトの場合 true
     */
    public static Boolean hasObjectApiName(String objectApiName) {
        return String.isNotBlank(objectApiName) &&
            OBJECT_API_NAMES.contains(objectApiName);
    }

    private static Map<String, MetricDefinition> createDefinitionsByKey() {
        Map<String, MetricDefinition> definitionsByKey = new Map<String, MetricDefinition>();

        for (MetricDefinition definition : ORDERED_DEFINITIONS) {
            definitionsByKey.put(definition.key, definition);
        }

        return definitionsByKey;
    }

    private static Set<String> createObjectApiNames() {
        Set<String> objectApiNames = new Set<String>();

        for (MetricDefinition definition : ORDERED_DEFINITIONS) {
            objectApiNames.add(definition.objectApiName);
        }

        return objectApiNames;
    }

    private static List<MetricDefinition> createOrderedDefinitions() {
        return new List<MetricDefinition>{
            new MetricDefinition('accounts', 'Account', present('取引先', 'standard:account')),
            new MetricDefinition(
                'contacts',
                'Contact',
                present('取引先責任者', 'standard:contact')
            ),
            new MetricDefinition('leads', 'Lead', present('リード', 'standard:lead')),
            new MetricDefinition(
                'opportunities',
                'Opportunity',
                present('商談', 'standard:opportunity')
            ),
            new MetricDefinition(
                'opportunityLineItems',
                'OpportunityLineItem',
                present('商談商品', 'standard:product_consumed')
            ),
            new MetricDefinition('products', 'Product2', present('商品', 'standard:product')),
            new MetricDefinition(
                'pricebooks',
                'Pricebook2',
                present('価格表', 'standard:pricebook')
            ),
            new MetricDefinition(
                'pricebookEntries',
                'PricebookEntry',
                present('価格表エントリ', 'standard:price_book_entries')
            ),
            new MetricDefinition('assets', 'Asset', present('納入商品', 'standard:asset_object')),
            new MetricDefinition(
                'campaigns',
                'Campaign',
                present('キャンペーン', 'standard:campaign')
            ),
            new MetricDefinition('cases', 'Case', present('ケース', 'standard:case')),
            new MetricDefinition(
                'contracts',
                'Contract',
                present('契約', 'standard:contract')
            ),
            new MetricDefinition('orders', 'Order', present('注文', 'standard:order_item')),
            new MetricDefinition(
                'orderItems',
                'OrderItem',
                present('注文商品', 'standard:order_item')
            ),
            new MetricDefinition(
                'entitlements',
                'Entitlement',
                present('エンタイトルメント', 'standard:entitlement')
            ),
            new MetricDefinition(
                'serviceContracts',
                'ServiceContract',
                present('サービス契約', 'standard:service_contract')
            ),
            new MetricDefinition(
                'workOrders',
                'WorkOrder',
                present('作業指示', 'standard:work_order')
            ),
            new MetricDefinition(
                'workOrderLineItems',
                'WorkOrderLineItem',
                present('作業指示品目', 'standard:work_order_item')
            ),
            new MetricDefinition(
                'knowledgeArticles',
                'KnowledgeArticleVersion',
                present('ナレッジ', 'utility:knowledge_base')
            ),
            new MetricDefinition('events', 'Event', present('行動', 'standard:event')),
            new MetricDefinition('tasks', 'Task', present('ToDo', 'standard:task')),
            new MetricDefinition(
                'emailMessages',
                'EmailMessage',
                present('メールメッセージ', 'standard:email')
            ),
            new MetricDefinition(
                'emailTemplates',
                'EmailTemplate',
                present('メールテンプレート', 'utility:insert_template')
            ),
            new MetricDefinition(
                'reports',
                'Report',
                present('レポート', 'standard:report')
            ),
            new MetricDefinition(
                'dashboards',
                'Dashboard',
                present('ダッシュボード', 'standard:dashboard')
            ),
            new MetricDefinition(
                'files',
                'ContentDocument',
                present('ファイル', 'standard:file')
            ),
            new MetricDefinition('users', 'User', present('ユーザー', 'standard:user'))
        };
    }

    private static MetricPresentation present(String label, String iconName) {
        return new MetricPresentation(label, iconName);
    }

    private class MetricPresentation {
        private String label;
        private String iconName;

        private MetricPresentation(String label, String iconName) {
            this.label = label;
            this.iconName = iconName;
        }
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

        /**
         * LWC 件数カードに表示する Lightning icon 名です。
         */
        @AuraEnabled
        public String iconName { get; private set; }

        private MetricDefinition(
            String key,
            String objectApiName,
            MetricPresentation presentation
        ) {
            this.key = key;
            this.objectApiName = objectApiName;
            this.label = presentation.label;
            this.iconName = presentation.iconName;
        }
    }
}