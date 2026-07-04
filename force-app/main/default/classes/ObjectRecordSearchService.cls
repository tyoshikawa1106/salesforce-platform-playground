/**
 * 汎用レコード検索画面の判定と Wrapper 組み立てを提供します。
 *
 * Controller が Selector から取得した describe / SOQL / DML 結果を受け取り、
 * Service は入力値の正規化、権限値の反映、返却用 Wrapper の作成に集中します。
 * Service から Selector を直接呼び出さないことで、データ取得順序を Controller 側で追いやすくします。
 */
public with sharing class ObjectRecordSearchService {
    private static final Integer PAGE_SIZE = 50;
    private static final Integer PAGE_FETCH_SIZE = PAGE_SIZE + 1;
    private static final String DELETE_ROW_ERROR_MESSAGE = '削除できないレコードがありました。';

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
     * 検索画面設定を作成します。
     * @param definition データボードカードと対象オブジェクトの定義
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return 検索画面設定
     */
    public ObjectRecordSearchConfigWrapper createObjectConfig(
        ObjectMetricCatalog.MetricDefinition definition,
        Schema.DescribeFieldResult nameFieldDescribe,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        return new ObjectRecordSearchConfigWrapper(
            definition,
            nameFieldDescribe,
            objectDescribe
        );
    }

    /**
     * 検索画面の内部処理状態を作成します。
     * @param config LWC に返す検索画面設定
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return 検索画面の内部処理状態
     */
    public ObjectRecordSearchContext createSearchContext(
        ObjectRecordSearchConfigWrapper config,
        Schema.DescribeFieldResult nameFieldDescribe,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        return new ObjectRecordSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
    }

    /**
     * 検索リクエストから安全なソート条件を作成します。
     * @param context 検索画面の内部処理状態
     * @param request 検索条件とページ指定
     * @return 許可済み項目と方向だけを持つソート条件
     */
    public ObjectRecordSearchSortSupport.SortSpec createSortSpec(
        ObjectRecordSearchContext context,
        ObjectRecordSearchRequestWrapper request
    ) {
        return ObjectRecordSearchSortSupport.createSortSpec(context, request);
    }

    /**
     * 検索条件、ソート条件、ページング条件をまとめます。
     * @param context 検索画面の内部処理状態
     * @param request 検索条件とページ指定
     * @param sortSpec 正規化済みソート条件
     * @return 検索クエリと結果整形で共有する検索条件
     */
    public ObjectRecordSearchQueryPlan.SearchQueryRequest createSearchQueryRequest(
        ObjectRecordSearchContext context,
        ObjectRecordSearchRequestWrapper request,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        searchQueryRequest.context = context;
        searchQueryRequest.searchRequest = request;
        searchQueryRequest.sortSpec = sortSpec;
        searchQueryRequest.cursor = ObjectRecordSearchSortSupport.parsePageToken(
            request?.pageToken,
            sortSpec
        );
        searchQueryRequest.fetchSize = PAGE_FETCH_SIZE;
        return searchQueryRequest;
    }

    /**
     * 検索結果レコードを LWC 返却用 Wrapper に変換します。
     * @param request 検索クエリと結果整形で共有する検索条件
     * @param records 検索結果 SObject
     * @return 1 ページ最大 50 件の検索結果
     */
    public ObjectRecordSearchResultWrapper createSearchResult(
        ObjectRecordSearchQueryPlan.SearchQueryRequest request,
        List<SObject> records
    ) {
        List<ObjectRecordSearchRowWrapper> rows = new List<ObjectRecordSearchRowWrapper>();
        for (SObject record : records) {
            rows.add(
                new ObjectRecordSearchRowWrapper(
                    record,
                    request.context.config.nameFieldApiName,
                    request.context.config.displayFields
                )
            );
        }

        Boolean hasNextPage = rows.size() > PAGE_SIZE;
        if (hasNextPage) {
            rows.remove(PAGE_SIZE);
        }

        String nextPageToken = hasNextPage
            ? ObjectRecordSearchSortSupport.createNextPageToken(
                  rows,
                  request.sortSpec
              )
            : null;

        return new ObjectRecordSearchResultWrapper(request.context.config, rows)
            .withPageState(
                PAGE_SIZE,
                normalizePageNumber(request.searchRequest?.pageNumber),
                nextPageToken
            );
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
        return config != null &&
            config.deletable &&
            recordIds != null &&
            !recordIds.isEmpty();
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
                errors.add(DELETE_ROW_ERROR_MESSAGE);
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
