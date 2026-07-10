/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口
 */
public with sharing class ObjectRecordSearchController {
    private static final String CONFIG_ERROR_MESSAGE = '検索画面を表示できませんでした。時間をおいてもう一度お試しください。';
    private static final String SEARCH_ERROR_MESSAGE = 'レコード一覧を表示できませんでした。検索条件を見直して、もう一度お試しください。';
    private static final String DELETE_ERROR_MESSAGE = '選択したレコードを削除できませんでした。権限やレコードの状態を確認してください。';

    private ObjectRecordSearchService service;
    private ObjectRecordSearchSelector selector;

    private ObjectRecordSearchController(
        ObjectRecordSearchService service,
        ObjectRecordSearchSelector selector
    ) {
        this.service = service;
        this.selector = selector;
    }

    /**
     * 表示キーに対応する検索画面設定を返す
     *
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchConfigWrapper getObjectConfig(
        String metricKey
    ) {
        ObjectRecordSearchController controller = new ObjectRecordSearchController(
            new ObjectRecordSearchService(),
            new ObjectRecordSearchSelector()
        );
        return controller.getObjectConfigForMetricKey(metricKey);
    }

    private ObjectRecordSearchConfigWrapper getObjectConfigForMetricKey(
        String metricKey
    ) {
        try {
            ObjectRecordSearchContext context = buildSearchContext(metricKey);
            return context.config;
        } catch (ObjectRecordSearchException error) {
            String errorMessage = error.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception error) {
            throw createHandledException(CONFIG_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索
     *
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchResultWrapper searchRecords(
        ObjectRecordSearchRequestWrapper request
    ) {
        ObjectRecordSearchController controller = new ObjectRecordSearchController(
            new ObjectRecordSearchService(),
            new ObjectRecordSearchSelector()
        );
        return controller.searchRecordsForRequest(request);
    }

    private ObjectRecordSearchResultWrapper searchRecordsForRequest(
        ObjectRecordSearchRequestWrapper request
    ) {
        try {
            String metricKey = request?.metricKey;
            ObjectRecordSearchContext context = buildSearchContext(
                metricKey
            );
            ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
                context,
                request
            );
            ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = service.createSearchQueryRequest(
                context,
                request,
                sortSpec
            );
            ObjectRecordSearchQueryPlan.SearchQuery searchQuery = ObjectRecordSearchQueryPlan.createSearchQuery(
                searchQueryRequest
            );
            List<SObject> records = selector.searchRecords(searchQuery);
            ObjectRecordSearchResultWrapper result = service.createSearchResult(
                searchQueryRequest,
                records
            );
            return result;
        } catch (ObjectRecordSearchException error) {
            String errorMessage = error.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception error) {
            throw createHandledException(SEARCH_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコード削除
     *
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    @AuraEnabled
    public static ObjectRecordSearchDeleteWrapper deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        ObjectRecordSearchController controller = new ObjectRecordSearchController(
            new ObjectRecordSearchService(),
            new ObjectRecordSearchSelector()
        );
        return controller.deleteSelectedRecords(metricKey, recordIds);
    }

    private ObjectRecordSearchDeleteWrapper deleteSelectedRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        try {
            ObjectRecordSearchContext context = buildSearchContext(
                metricKey
            );
            ObjectRecordSearchConfigWrapper config = context.config;
            Boolean canDeleteRecords = service.canDeleteRecords(
                config,
                recordIds
            );
            if (!canDeleteRecords) {
                return service.createDeleteResult(recordIds, null);
            }
            Set<Id> recordIdsToDelete = new Set<Id>(recordIds);
            List<SObject> recordsToDelete = selector.getRecordsById(
                config.objectApiName,
                recordIdsToDelete
            );
            List<Database.DeleteResult> deleteResults = selector.deleteRecords(
                recordsToDelete
            );
            ObjectRecordSearchDeleteWrapper result = service.createDeleteResult(
                recordIds,
                deleteResults
            );
            return result;
        } catch (ObjectRecordSearchException error) {
            String errorMessage = error.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception error) {
            throw createHandledException(DELETE_ERROR_MESSAGE);
        }
    }

    private ObjectRecordSearchContext buildSearchContext(
        String metricKey
    ) {
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
            metricKey
        );
        Schema.DescribeSObjectResult objectDescribe = selector.getObjectDescribe(
            definition.objectApiName
        );
        Schema.DescribeFieldResult nameFieldDescribe = selector.getNameFieldDescribe(
            objectDescribe
        );
        List<ObjectRecordSearchFieldWrapper> displayFields = ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
            definition.objectApiName,
            objectDescribe
        );
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        );
        config = config.withDisplayFields(displayFields);
        ObjectRecordSearchContext context = service.createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
        return context;
    }

    private static AuraHandledException createHandledException(String message) {
        return new AuraHandledException(message);
    }
}
