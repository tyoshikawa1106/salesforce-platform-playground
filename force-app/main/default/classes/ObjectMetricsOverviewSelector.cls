/**
 * オブジェクト件数一覧で使う件数を問い合わせます。
 */
public virtual with sharing class ObjectMetricsOverviewSelector {
    private static final Integer MAX_DISPLAY_COUNT = 50000;
    private static final Set<String> COUNTABLE_OBJECT_API_NAMES = new Set<String>{
        'Account',
        'Contact',
        'Lead',
        'Opportunity',
        'OpportunityLineItem',
        'Product2',
        'Pricebook2',
        'PricebookEntry',
        'Asset',
        'Campaign',
        'Case',
        'Contract',
        'Order',
        'OrderItem',
        'Entitlement',
        'ServiceContract',
        'WorkOrder',
        'WorkOrderLineItem',
        'KnowledgeArticleVersion',
        'Event',
        'Task',
        'EmailMessage',
        'EmailTemplate',
        'Report',
        'Dashboard',
        'ContentDocument',
        'User'
    };

    /**
     * 表示キーごとのオブジェクト件数を取得します。
     * @return オブジェクト件数一覧で使う表示キー別の件数
     */
    public virtual Map<String, ObjectMetricCount> getObjectMetricValues() {
        return new Map<String, ObjectMetricCount>{
            'accounts' => countVisibleRecords('Account'),
            'contacts' => countVisibleRecords('Contact'),
            'leads' => countVisibleRecords('Lead'),
            'opportunities' => countVisibleRecords('Opportunity'),
            'opportunityLineItems' => countVisibleRecords(
                'OpportunityLineItem'
            ),
            'products' => countVisibleRecords('Product2'),
            'pricebooks' => countVisibleRecords('Pricebook2'),
            'pricebookEntries' => countVisibleRecords('PricebookEntry'),
            'assets' => countVisibleRecords('Asset'),
            'campaigns' => countVisibleRecords('Campaign'),
            'cases' => countVisibleRecords('Case'),
            'contracts' => countVisibleRecords('Contract'),
            'orders' => countVisibleRecords('Order'),
            'orderItems' => countVisibleRecords('OrderItem'),
            'entitlements' => countVisibleRecords('Entitlement'),
            'serviceContracts' => countVisibleRecords('ServiceContract'),
            'workOrders' => countVisibleRecords('WorkOrder'),
            'workOrderLineItems' => countVisibleRecords('WorkOrderLineItem'),
            'knowledgeArticles' => countVisibleRecords(
                'KnowledgeArticleVersion'
            ),
            'events' => countVisibleRecords('Event'),
            'tasks' => countVisibleRecords('Task'),
            'emailMessages' => countVisibleRecords('EmailMessage'),
            'emailTemplates' => countVisibleRecords('EmailTemplate'),
            'reports' => countVisibleRecords('Report'),
            'dashboards' => countVisibleRecords('Dashboard'),
            'files' => countVisibleRecords('ContentDocument'),
            'users' => countVisibleRecords('User')
        };
    }

    /**
     * 表示上限を考慮した件数結果を作成します。
     * @param value 件数値
     * @return 表示上限に達した場合は capped を付けた件数結果
     */
    @TestVisible
    private static ObjectMetricCount createCount(Integer value) {
        Integer safeValue = value ?? 0;
        return safeValue >= MAX_DISPLAY_COUNT
            ? createCappedCount()
            : new ObjectMetricCount(safeValue, false);
    }

    /**
     * 表示上限に達した件数結果を作成します。
     * @return capped を付けた件数結果
     */
    private static ObjectMetricCount createCappedCount() {
        return new ObjectMetricCount(MAX_DISPLAY_COUNT, true);
    }

    @TestVisible
    private ObjectMetricCount countVisibleRecords(String objectApiName) {
        if (
            String.isBlank(objectApiName) ||
            !COUNTABLE_OBJECT_API_NAMES.contains(objectApiName) ||
            !isObjectAccessible(objectApiName)
        ) {
            return toObjectMetricCount(0);
        }

        String whereClause = objectApiName == 'User'
            ? ' WHERE IsActive = TRUE'
            : '';
        String query =
            'SELECT COUNT() FROM ' +
            objectApiName +
            whereClause +
            ' WITH USER_MODE LIMIT ' +
            MAX_DISPLAY_COUNT;

        try {
            return toObjectMetricCount(Database.countQuery(query));
        } catch (QueryException queryException) {
            return toObjectMetricCount(0);
        }
    }

    private ObjectMetricCount countRecycleBinItems() {
        Id deletedByUserId = UserInfo.getUserId();
        Integer totalCount = 0;
        Boolean capped = false;

        if (isObjectAccessible('Account')) {
            ObjectMetricCount accountCount = countDeletedAccounts(
                deletedByUserId
            );
            totalCount += accountCount.value;
            capped = capped || accountCount.capped;
        }
        if (isObjectAccessible('Contact')) {
            ObjectMetricCount contactCount = countDeletedContacts(
                deletedByUserId
            );
            totalCount += contactCount.value;
            capped = capped || contactCount.capped;
        }

        return capped ? createCappedCount() : toObjectMetricCount(totalCount);
    }

    private ObjectMetricCount countDeletedAccounts(Id deletedByUserId) {
        return toObjectMetricCount(
            [
                SELECT COUNT()
                FROM Account
                WHERE IsDeleted = TRUE AND LastModifiedById = :deletedByUserId
                WITH USER_MODE
                LIMIT :MAX_DISPLAY_COUNT
                ALL ROWS
            ]
        );
    }

    private ObjectMetricCount countDeletedContacts(Id deletedByUserId) {
        return toObjectMetricCount(
            [
                SELECT COUNT()
                FROM Contact
                WHERE IsDeleted = TRUE AND LastModifiedById = :deletedByUserId
                WITH USER_MODE
                LIMIT :MAX_DISPLAY_COUNT
                ALL ROWS
            ]
        );
    }

    private Boolean isObjectAccessible(String objectApiName) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(objectApiName);
        return sObjectType != null &&
            sObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
                .isAccessible();
    }

    private ObjectMetricCount toObjectMetricCount(Integer value) {
        return createCount(value);
    }

    /**
     * 表示上限情報を含む件数結果です。
     */
    public class ObjectMetricCount {
        /**
         * 表示上限で丸めた件数値です。
         */
        public Integer value { get; private set; }

        /**
         * 件数が表示上限に達したかどうかを示します。
         */
        public Boolean capped { get; private set; }

        /**
         * 表示用に上限処理済みの件数を作成します。
         * @param value 表示用に上限処理済みの件数値
         * @param capped 件数が表示上限に達したかどうか
         */
        private ObjectMetricCount(Integer value, Boolean capped) {
            this.value = value;
            this.capped = capped;
        }
    }
}
