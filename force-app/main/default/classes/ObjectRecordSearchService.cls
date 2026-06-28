/**
 * 汎用レコード検索画面の判定と Wrapper 組み立てを提供します。
 */
public with sharing class ObjectRecordSearchService {
    private static final Integer PAGE_SIZE = 50;
    private static final Integer PAGE_FETCH_SIZE = PAGE_SIZE + 1;

    /**
     * 表示キーに対応するデータボード定義を返します。
     * @param metricKey データボードカードの表示キー
     * @return データボードカードと対象オブジェクトの定義
     */
    public ObjectMetricCatalog.MetricDefinition requireDefinition(
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

    /**
     * 対象オブジェクトの参照権限と固定項目を作成します。
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @param displayFields 一覧に追加表示する固定項目
     * @return 対象オブジェクトの参照権限と固定項目
     */
    public ObjectRecordSearchAccessWrapper createAccess(
        Schema.DescribeSObjectResult objectDescribe,
        List<ObjectRecordSearchFieldWrapper> displayFields
    ) {
        return new ObjectRecordSearchAccessWrapper(
            objectDescribe,
            displayFields
        );
    }

    /**
     * 検索画面設定を作成します。
     * @param definition データボードカードと対象オブジェクトの定義
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param access 対象オブジェクトの参照権限と固定項目
     * @return 検索画面設定
     */
    public ObjectRecordSearchConfigWrapper createObjectConfig(
        ObjectMetricCatalog.MetricDefinition definition,
        Schema.DescribeFieldResult nameFieldDescribe,
        ObjectRecordSearchAccessWrapper access
    ) {
        return new ObjectRecordSearchConfigWrapper(
            definition,
            nameFieldDescribe,
            access
        );
    }

    /**
     * 検索条件から SOQL と bind 値を作成します。
     * @param config 検索画面設定
     * @param request 検索条件とページ指定
     * @return 実行可能な検索クエリ計画
     */
    public ObjectRecordSearchQueryPlan.SearchQuery createSearchQuery(
        ObjectRecordSearchConfigWrapper config,
        ObjectRecordSearchRequestWrapper request
    ) {
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            config,
            request
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        searchQueryRequest.config = config;
        searchQueryRequest.searchRequest = request;
        searchQueryRequest.sortSpec = sortSpec;
        searchQueryRequest.cursor = ObjectRecordSearchSortSupport.parsePageToken(
            request?.pageToken,
            sortSpec
        );
        searchQueryRequest.fetchSize = PAGE_FETCH_SIZE;
        return ObjectRecordSearchQueryPlan.createSearchQuery(
            searchQueryRequest
        );
    }

    /**
     * 検索結果レコードを LWC 返却用 Wrapper に変換します。
     * @param config 検索画面設定
     * @param records 検索結果 SObject
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    public ObjectRecordSearchResultWrapper createSearchResult(
        ObjectRecordSearchConfigWrapper config,
        List<SObject> records,
        ObjectRecordSearchRequestWrapper request
    ) {
        List<ObjectRecordSearchRowWrapper> rows = new List<ObjectRecordSearchRowWrapper>();
        for (SObject record : records) {
            rows.add(
                new ObjectRecordSearchRowWrapper(
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

        ObjectRecordSearchPageStateWrapper pageState = new ObjectRecordSearchPageStateWrapper();
        pageState.pageSize = PAGE_SIZE;
        pageState.pageNumber = normalizePageNumber(request?.pageNumber);
        pageState.nextPageToken = hasNextPage
            ? ObjectRecordSearchSortSupport.createNextPageToken(
                  rows,
                  ObjectRecordSearchSortSupport.createSortSpec(config, request)
              )
            : null;

        return new ObjectRecordSearchResultWrapper(config, rows, pageState);
    }

    /**
     * 選択レコードを削除してよいかを返します。
     * @param config 検索画面設定
     * @param recordIds 削除するレコード ID
     * @return 削除対象 ID があり、対象オブジェクトを削除可能な場合 true
     */
    public Boolean canDeleteRecords(
        ObjectRecordSearchConfigWrapper config,
        List<Id> recordIds
    ) {
        return config.deletable && recordIds != null && !recordIds.isEmpty();
    }

    /**
     * DML 削除結果を LWC 返却用 Wrapper に変換します。
     * @param recordIds LWC から削除要求された ID
     * @param deleteResults DML 削除結果
     * @return 削除結果
     */
    public ObjectRecordSearchDeleteWrapper createDeleteResult(
        List<Id> recordIds,
        List<Database.DeleteResult> deleteResults
    ) {
        Integer requestedCount = recordIds == null ? 0 : recordIds.size();
        Integer deletedCount = 0;
        List<String> errors = new List<String>();

        if (deleteResults != null) {
            for (Database.DeleteResult deleteResult : deleteResults) {
                if (deleteResult.isSuccess()) {
                    deletedCount++;
                    continue;
                }
                for (Database.Error deleteError : deleteResult.getErrors()) {
                    errors.add(deleteError.getMessage());
                }
            }
        }

        return new ObjectRecordSearchDeleteWrapper(
            requestedCount,
            deletedCount,
            errors
        );
    }

    private Integer normalizePageNumber(Integer pageNumber) {
        return pageNumber == null || pageNumber < 1 ? 1 : pageNumber;
    }
}
