/**
 * 汎用レコード検索画面で使う Salesforce レコードを問い合わせます。
 */
@SuppressWarnings('PMD.CyclomaticComplexity')
public virtual with sharing class ObjectRecordSearchSelector {
    private static final Integer PAGE_SIZE = 50;
    private static final Integer PAGE_FETCH_SIZE = PAGE_SIZE + 1;
    private static final Map<String, List<String>> DISPLAY_FIELDS_BY_OBJECT = new Map<String, List<String>>{
        'Account' => new List<String>{
            'AccountNumber',
            'Industry',
            'Type',
            'Rating',
            'Phone',
            'Website',
            'BillingCity',
            'BillingState',
            'BillingCountry'
        },
        'Contact' => new List<String>{
            'Title',
            'Department',
            'Email',
            'Phone',
            'MobilePhone',
            'LeadSource',
            'MailingCity',
            'Description'
        },
        'Lead' => new List<String>{
            'Company',
            'Title',
            'Status',
            'Rating',
            'Industry',
            'LeadSource',
            'Email',
            'Phone',
            'Website',
            'City',
            'Description'
        },
        'Opportunity' => new List<String>{
            'StageName',
            'Type',
            'LeadSource',
            'CloseDate',
            'Amount',
            'Probability',
            'NextStep',
            'Description'
        },
        'OpportunityLineItem' => new List<String>{
            'Quantity',
            'UnitPrice',
            'ServiceDate',
            'Description'
        },
        'Product2' => new List<String>{
            'ProductCode',
            'Family',
            'QuantityUnitOfMeasure',
            'IsActive',
            'Description'
        },
        'Pricebook2' => new List<String>{ 'IsStandard', 'IsActive' },
        'PricebookEntry' => new List<String>{
            'UnitPrice',
            'IsActive',
            'UseStandardPrice'
        },
        'Asset' => new List<String>{
            'Status',
            'Quantity',
            'Price',
            'PurchaseDate',
            'InstallDate',
            'UsageEndDate',
            'SerialNumber',
            'Description'
        },
        'Campaign' => new List<String>{
            'Type',
            'Status',
            'IsActive',
            'StartDate',
            'EndDate',
            'ExpectedRevenue',
            'BudgetedCost',
            'ActualCost',
            'ExpectedResponse',
            'NumberSent',
            'Description'
        },
        'CampaignMember' => new List<String>{ 'Status' },
        'Case' => new List<String>{
            'Type',
            'Origin',
            'Status',
            'Priority',
            'Reason',
            'SuppliedName',
            'SuppliedEmail',
            'SuppliedPhone',
            'SuppliedCompany',
            'Description'
        },
        'Contract' => new List<String>{
            'Status',
            'StartDate',
            'ContractTerm',
            'CustomerSignedTitle',
            'CustomerSignedDate',
            'OwnerExpirationNotice',
            'BillingCity',
            'BillingState',
            'Description'
        },
        'Order' => new List<String>{
            'Type',
            'Status',
            'EffectiveDate',
            'BillingCity',
            'ShippingCity',
            'Description'
        },
        'OrderItem' => new List<String>{
            'Quantity',
            'UnitPrice',
            'ServiceDate',
            'Description'
        },
        'Entitlement' => new List<String>{
            'Type',
            'StartDate',
            'EndDate',
            'Description'
        },
        'ServiceContract' => new List<String>{
            'Status',
            'StartDate',
            'EndDate',
            'Term',
            'BillingCity',
            'ShippingCity',
            'ShippingHandling',
            'Tax',
            'Description'
        },
        'ContractLineItem' => new List<String>{
            'Quantity',
            'UnitPrice',
            'Discount',
            'StartDate',
            'EndDate',
            'Description'
        },
        'WorkOrder' => new List<String>{
            'Status',
            'Priority',
            'City',
            'PostalCode',
            'Description'
        },
        'WorkOrderLineItem' => new List<String>{
            'Status',
            'Description'
        },
        'Task' => new List<String>{
            'Status',
            'Priority',
            'ActivityDate',
            'Description'
        },
        'Event' => new List<String>{
            'StartDateTime',
            'EndDateTime',
            'Location',
            'ShowAs',
            'Description'
        },
        'EmailMessage' => new List<String>{
            'FromAddress',
            'ToAddress',
            'MessageDate',
            'Incoming',
            'Status',
            'TextBody'
        },
        'ContentDocument' => new List<String>{
            'FileType',
            'FileExtension',
            'ContentSize'
        }
    };

    /**
     * 表示キーに対応する検索画面設定を返します。
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    public virtual ObjectRecordSearchController.ObjectRecordSearchConfig getObjectConfig(
        String metricKey
    ) {
        ObjectMetricCatalog.MetricDefinition definition = requireDefinition(
            metricKey
        );
        Schema.DescribeSObjectResult objectDescribe = requireObjectDescribe(
            definition
        );
        Schema.DescribeFieldResult nameFieldDescribe = requireNameFieldDescribe(
            objectDescribe
        );

        return new ObjectRecordSearchController.ObjectRecordSearchConfig(
            definition,
            nameFieldDescribe,
            new ObjectRecordSearchController.ObjectRecordSearchAccess(
                objectDescribe,
                getDisplayFields(definition.objectApiName, objectDescribe)
            )
        );
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索します。
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual ObjectRecordSearchController.ObjectRecordSearchResult searchRecords(
        ObjectRecordSearchController.ObjectRecordSearchRequest request
    ) {
        ObjectRecordSearchController.ObjectRecordSearchConfig config = getObjectConfig(
            request?.metricKey
        );
        PageCursor cursor = parsePageToken(request?.pageToken);
        String normalizedSearchTerm = request?.searchTerm?.trim();
        String likeSearchTerm = usesNameSearch(normalizedSearchTerm, config)
            ? '%' + normalizedSearchTerm + '%'
            : null;
        Map<String, Object> bindValues = new Map<String, Object>();
        if (likeSearchTerm != null) {
            bindValues.put('nameSearchTerm', likeSearchTerm);
        }
        if (cursor != null) {
            bindValues.put('cursorName', cursor.name);
            bindValues.put('cursorRecordId', cursor.recordId);
        }
        String query = createSearchQuery(config, likeSearchTerm != null, cursor);

        List<ObjectRecordSearchController.ObjectRecordRow> rows = new List<ObjectRecordSearchController.ObjectRecordRow>();
        for (
            SObject record : Database.queryWithBinds(
                query,
                bindValues,
                AccessLevel.USER_MODE
            )
        ) {
            rows.add(
                new ObjectRecordSearchController.ObjectRecordRow(
                    record,
                    config.nameFieldApiName,
                    config.displayFields
                )
            );
        }

        Boolean hasNextPage = rows.size() > PAGE_SIZE;
        if (hasNextPage) {
            rows.remove(PAGE_SIZE);
        }

        return new ObjectRecordSearchController.ObjectRecordSearchResult(
            config,
            rows,
            createPageState(
                normalizePageNumber(request?.pageNumber),
                hasNextPage ? createNextPageToken(rows) : null
            )
        );
    }

    private String createSearchQuery(
        ObjectRecordSearchController.ObjectRecordSearchConfig config,
        Boolean includeNameSearch,
        PageCursor cursor
    ) {
        String query =
            'SELECT Id, ' +
            String.join(getQueryFields(config), ', ') +
            ' FROM ' +
            config.objectApiName;

        List<String> whereClauses = new List<String>();
        if (includeNameSearch) {
            whereClauses.add(
                config.nameFieldApiName + ' LIKE :nameSearchTerm'
            );
        }
        if (cursor != null) {
            whereClauses.add(
                '(' +
                    config.nameFieldApiName +
                    ' > :cursorName OR (' +
                    config.nameFieldApiName +
                    ' = :cursorName AND Id > :cursorRecordId))'
            );
        }

        if (!whereClauses.isEmpty()) {
            query += ' WHERE ' + String.join(whereClauses, ' AND ');
        }

        return query +
            ' ORDER BY ' +
            config.nameFieldApiName +
            ' ASC, Id ASC LIMIT ' +
            PAGE_FETCH_SIZE;
    }

    private List<String> getQueryFields(
        ObjectRecordSearchController.ObjectRecordSearchConfig config
    ) {
        Set<String> fieldApiNames = new Set<String>{ config.nameFieldApiName };
        for (
            ObjectRecordSearchController.ObjectRecordDisplayField displayField : config.displayFields
        ) {
            fieldApiNames.add(displayField.apiName);
        }
        return new List<String>(fieldApiNames);
    }

    private Boolean usesNameSearch(
        String normalizedSearchTerm,
        ObjectRecordSearchController.ObjectRecordSearchConfig config
    ) {
        return String.isNotBlank(normalizedSearchTerm) && config.searchable;
    }

    private List<ObjectRecordSearchController.ObjectRecordDisplayField> getDisplayFields(
        String objectApiName,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        List<ObjectRecordSearchController.ObjectRecordDisplayField> displayFields = new List<ObjectRecordSearchController.ObjectRecordDisplayField>();
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        for (String fieldApiName : getDisplayFieldApiNames(objectApiName)) {
            if (!fieldsByApiName.containsKey(fieldApiName)) {
                continue;
            }

            Schema.DescribeFieldResult fieldDescribe = fieldsByApiName.get(
                    fieldApiName
                )
                .getDescribe();
            if (!fieldDescribe.isAccessible()) {
                continue;
            }

            displayFields.add(
                new ObjectRecordSearchController.ObjectRecordDisplayField(
                    fieldDescribe.getName(),
                    fieldDescribe.getLabel()
                )
            );
        }
        return displayFields;
    }

    private List<String> getDisplayFieldApiNames(String objectApiName) {
        if (!DISPLAY_FIELDS_BY_OBJECT.containsKey(objectApiName)) {
            return new List<String>();
        }
        return DISPLAY_FIELDS_BY_OBJECT.get(objectApiName);
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコードを削除します。
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    public virtual ObjectRecordSearchController.ObjectRecordDeleteResult deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        ObjectRecordSearchController.ObjectRecordSearchConfig config = getObjectConfig(
            metricKey
        );
        if (!config.deletable || recordIds == null || recordIds.isEmpty()) {
            return new ObjectRecordSearchController.ObjectRecordDeleteResult(
                recordIds == null ? 0 : recordIds.size(),
                0,
                new List<String>()
            );
        }

        List<SObject> recordsToDelete = queryRecordsById(
            config.objectApiName,
            new Set<Id>(recordIds)
        );
        Database.DeleteResult[] deleteResults = Database.delete(
            recordsToDelete,
            false,
            AccessLevel.USER_MODE
        );
        Integer deletedCount = 0;
        List<String> errors = new List<String>();

        for (Database.DeleteResult deleteResult : deleteResults) {
            if (deleteResult.isSuccess()) {
                deletedCount++;
                continue;
            }
            for (Database.Error deleteError : deleteResult.getErrors()) {
                errors.add(deleteError.getMessage());
            }
        }

        return new ObjectRecordSearchController.ObjectRecordDeleteResult(
            recordIds.size(),
            deletedCount,
            errors
        );
    }

    @SuppressWarnings('PMD.ApexSOQLInjection')
    private List<SObject> queryRecordsById(
        String objectApiName,
        Set<Id> recordIds
    ) {
        if (recordIds == null || recordIds.isEmpty()) {
            return new List<SObject>();
        }

        return Database.queryWithBinds(
            'SELECT Id FROM ' +
                objectApiName +
                ' WHERE Id IN :recordIds LIMIT ' +
                recordIds.size(),
            new Map<String, Object>{ 'recordIds' => recordIds },
            AccessLevel.USER_MODE
        );
    }

    private Integer normalizePageNumber(Integer pageNumber) {
        return pageNumber == null || pageNumber < 1 ? 1 : pageNumber;
    }

    private String createNextPageToken(
        List<ObjectRecordSearchController.ObjectRecordRow> rows
    ) {
        ObjectRecordSearchController.ObjectRecordRow lastRow = rows[
            rows.size() - 1
        ];
        return JSON.serialize(
            new Map<String, String>{
                'name' => lastRow.name,
                'recordId' => String.valueOf(lastRow.id)
            }
        );
    }

    private ObjectRecordSearchController.ObjectRecordSearchPageState createPageState(
        Integer pageNumber,
        String nextPageToken
    ) {
        ObjectRecordSearchController.ObjectRecordSearchPageState pageState = new ObjectRecordSearchController.ObjectRecordSearchPageState();
        pageState.pageSize = PAGE_SIZE;
        pageState.pageNumber = pageNumber;
        pageState.nextPageToken = nextPageToken;
        return pageState;
    }

    private PageCursor parsePageToken(String pageToken) {
        if (String.isBlank(pageToken)) {
            return null;
        }

        Map<String, Object> tokenParts = (Map<String, Object>) JSON.deserializeUntyped(
            pageToken
        );
        String cursorName = (String) tokenParts.get('name');
        String cursorRecordId = (String) tokenParts.get('recordId');
        if (String.isBlank(cursorName) || String.isBlank(cursorRecordId)) {
            throw new ObjectRecordSearchException(
                'ページ指定を読み込めません。'
            );
        }

        return new PageCursor(cursorName, (Id) cursorRecordId);
    }

    private class PageCursor {
        private final String name;
        private final Id recordId;

        private PageCursor(String name, Id recordId) {
            this.name = name;
            this.recordId = recordId;
        }
    }

    private ObjectMetricCatalog.MetricDefinition requireDefinition(
        String metricKey
    ) {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            metricKey
        );
        if (definition == null) {
            throw new ObjectRecordSearchException('未対応のオブジェクトです。');
        }
        return definition;
    }

    private Schema.DescribeSObjectResult requireObjectDescribe(
        ObjectMetricCatalog.MetricDefinition definition
    ) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(definition.objectApiName);
        if (sObjectType == null) {
            throw new ObjectRecordSearchException(
                '対象オブジェクトが見つかりません。'
            );
        }

        Schema.DescribeSObjectResult objectDescribe = sObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        if (!objectDescribe.isAccessible() || !objectDescribe.isQueryable()) {
            throw new ObjectRecordSearchException(
                '対象オブジェクトを参照できません。'
            );
        }
        return objectDescribe;
    }

    private Schema.DescribeFieldResult requireNameFieldDescribe(
        Schema.DescribeSObjectResult objectDescribe
    ) {
        Schema.DescribeFieldResult nameFieldDescribe;

        for (
            Schema.SObjectField fieldToken : objectDescribe.fields.getMap()
                .values()
        ) {
            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            if (fieldDescribe.isNameField()) {
                nameFieldDescribe = fieldDescribe;
                break;
            }
        }

        if (
            nameFieldDescribe == null &&
            objectDescribe.fields.getMap().containsKey('Name')
        ) {
            nameFieldDescribe = objectDescribe.fields.getMap()
                .get('Name')
                .getDescribe();
        }

        if (nameFieldDescribe == null) {
            throw new ObjectRecordSearchException(
                'Name 項目を取得できません。'
            );
        }

        if (!nameFieldDescribe.isAccessible()) {
            throw new ObjectRecordSearchException(
                'Name 項目を参照できません。'
            );
        }
        return nameFieldDescribe;
    }

    /**
     * 汎用レコード検索の入力・権限検証エラーです。
     */
    public class ObjectRecordSearchException extends Exception {
    }
}
