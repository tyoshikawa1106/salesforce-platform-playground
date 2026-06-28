/**
 * 汎用レコード検索画面で使う Salesforce レコードを問い合わせます。
 */
public virtual with sharing class ObjectRecordSearchSelector {
    private static final Integer PAGE_SIZE = 50;
    private static final Integer PAGE_FETCH_SIZE = PAGE_SIZE + 1;

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
                ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
                    definition.objectApiName,
                    objectDescribe
                )
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
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            config,
            request
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = ObjectRecordSearchSortSupport.parsePageToken(
            request?.pageToken,
            sortSpec
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        searchQueryRequest.config = config;
        searchQueryRequest.searchRequest = request;
        searchQueryRequest.sortSpec = sortSpec;
        searchQueryRequest.cursor = cursor;
        searchQueryRequest.fetchSize = PAGE_FETCH_SIZE;
        ObjectRecordSearchQueryPlan.SearchQuery searchQuery = ObjectRecordSearchQueryPlan.createSearchQuery(
            searchQueryRequest
        );

        List<ObjectRecordSearchController.ObjectRecordRow> rows = new List<ObjectRecordSearchController.ObjectRecordRow>();
        for (
            SObject record : Database.queryWithBinds(
                searchQuery.soql,
                searchQuery.bindValues,
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
                hasNextPage
                    ? ObjectRecordSearchSortSupport.createNextPageToken(
                          rows,
                          sortSpec
                      )
                    : null
            )
        );
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
