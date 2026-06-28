/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口です。
 *
 * Controller は LWC から呼ばれる公開 API と処理順序の組み立てだけを担当します。
 * Service と Selector のやり取りはここで引数と戻り値として明示し、
 * Service から直接 SOQL / DML を呼ばない構成にしています。
 * LWC に返す例外メッセージへの変換も Apex 境界である Controller に集約します。
 */
public with sharing class ObjectRecordSearchController {
    private static final String CONFIG_ERROR_MESSAGE = '検索画面設定を読み込めませんでした。';
    private static final String SEARCH_ERROR_MESSAGE = 'レコード一覧を読み込めませんでした。';
    private static final String DELETE_ERROR_MESSAGE = '選択したレコードを削除できませんでした。';
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
            return buildSearchContext(metricKey).config;
        } catch (ObjectRecordSearchException error) {
            throw createHandledException(error.getMessage());
        } catch (Exception error) {
            throw createHandledException(CONFIG_ERROR_MESSAGE);
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
            ObjectRecordSearchContext context = buildSearchContext(
                request?.metricKey
            );
            ObjectRecordSearchSortSupport.SortSpec sortSpec = SERVICE.createSortSpec(
                context,
                request
            );
            ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = SERVICE.createSearchQueryRequest(
                context,
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
        } catch (ObjectRecordSearchException error) {
            throw createHandledException(error.getMessage());
        } catch (Exception error) {
            throw createHandledException(SEARCH_ERROR_MESSAGE);
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
            ObjectRecordSearchContext context = buildSearchContext(
                metricKey
            );
            ObjectRecordSearchConfigWrapper config = context.config;
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
        } catch (ObjectRecordSearchException error) {
            throw createHandledException(error.getMessage());
        } catch (Exception error) {
            throw createHandledException(DELETE_ERROR_MESSAGE);
        }
    }

    private static ObjectRecordSearchContext buildSearchContext(
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
        List<ObjectRecordSearchFieldWrapper> displayFields = ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
            definition.objectApiName,
            objectDescribe
        );

        ObjectRecordSearchConfigWrapper config = SERVICE.createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        )
            .withDisplayFields(displayFields);
        return SERVICE.createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
    }

    private static AuraHandledException createHandledException(String message) {
        return new AuraHandledException(message);
    }
}
