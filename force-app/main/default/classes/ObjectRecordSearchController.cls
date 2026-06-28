/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口です。
 */
public with sharing class ObjectRecordSearchController {
    private static final String USER_FACING_ERROR_MESSAGE = 'レコード一覧を読み込めませんでした。';
    private static final ObjectRecordSearchService SERVICE = new ObjectRecordSearchService();
    private static final ObjectRecordSearchSelector SELECTOR = new ObjectRecordSearchSelector();

    /**
     * 表示キーに対応する検索画面設定を返します。
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchConfigWrapper getObjectConfig(
        String metricKey
    ) {
        try {
            return buildObjectConfig(metricKey);
        } catch (Exception error) {
            throw new AuraHandledException(USER_FACING_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索します。
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchResultWrapper searchRecords(
        ObjectRecordSearchRequestWrapper request
    ) {
        try {
            ObjectRecordSearchConfigWrapper config = buildObjectConfig(
                request?.metricKey
            );
            ObjectRecordSearchSortSupport.SortSpec sortSpec = SERVICE.createSortSpec(
                config,
                request
            );
            ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = SERVICE.createSearchQueryRequest(
                config,
                request,
                sortSpec
            );
            ObjectRecordSearchQueryPlan.SearchQuery searchQuery = SERVICE.createSearchQuery(
                searchQueryRequest
            );
            List<SObject> records = SELECTOR.searchRecords(searchQuery);

            return SERVICE.createSearchResult(
                searchQueryRequest,
                records
            );
        } catch (Exception error) {
            throw new AuraHandledException(USER_FACING_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコードを削除します。
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    @AuraEnabled
    public static ObjectRecordSearchDeleteWrapper deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        try {
            ObjectRecordSearchConfigWrapper config = buildObjectConfig(
                metricKey
            );
            if (!SERVICE.canDeleteRecords(config, recordIds)) {
                return SERVICE.createDeleteResult(recordIds, null);
            }

            List<SObject> recordsToDelete = SELECTOR.getRecordsById(
                config.objectApiName,
                new Set<Id>(recordIds)
            );
            return SERVICE.createDeleteResult(
                recordIds,
                SELECTOR.deleteRecords(recordsToDelete)
            );
        } catch (Exception error) {
            throw new AuraHandledException(
                '選択したレコードを削除できませんでした。'
            );
        }
    }

    private static ObjectRecordSearchConfigWrapper buildObjectConfig(
        String metricKey
    ) {
        ObjectMetricCatalog.MetricDefinition definition = SERVICE.requireDefinition(
            metricKey
        );
        Schema.DescribeSObjectResult objectDescribe = SELECTOR.getObjectDescribe(
            definition.objectApiName
        );
        Schema.DescribeFieldResult nameFieldDescribe = SELECTOR.getNameFieldDescribe(
            objectDescribe
        );
        ObjectRecordSearchAccessWrapper access = SERVICE.createAccess(
            objectDescribe,
            ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
                definition.objectApiName,
                objectDescribe
            )
        );

        return SERVICE.createObjectConfig(
            definition,
            nameFieldDescribe,
            access
        );
    }
}
