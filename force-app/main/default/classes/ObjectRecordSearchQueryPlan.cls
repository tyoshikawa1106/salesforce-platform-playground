/**
 * 汎用レコード検索の安全なクエリ計画を組み立てます。
 */
public with sharing class ObjectRecordSearchQueryPlan {
    /**
     * 検索条件から SOQL と bind 値を作成します。
     * @param request 検索クエリ計画の作成条件
     * @return 実行可能な検索クエリ計画
     */
    public static SearchQuery createSearchQuery(
        SearchQueryRequest request
    ) {
        SearchQuery query = new SearchQuery();
        query.bindValues = new Map<String, Object>();

        String normalizedSearchTerm = request.searchRequest?.searchTerm?.trim();
        String likeSearchTerm = usesNameSearch(
                normalizedSearchTerm,
                request.context.config
            )
            ? '%' + normalizedSearchTerm + '%'
            : null;
        if (likeSearchTerm != null) {
            query.bindValues.put('nameSearchTerm', likeSearchTerm);
        }
        if (request.cursor != null) {
            query.bindValues.put('cursorSortValue', request.cursor.sortValue);
            query.bindValues.put('cursorRecordId', request.cursor.recordId);
        }

        query.soql = buildSearchSoql(request, likeSearchTerm != null);
        return query;
    }

    /**
     * 検索時に SELECT する項目 API 参照名を返します。
     * @param context 検索画面の内部処理状態
     * @return Name 項目と表示項目の重複を除いた一覧
     */
    public static List<String> getQueryFields(
        ObjectRecordSearchContext context
    ) {
        return context.getQueryFieldApiNames();
    }

    private static String buildSearchSoql(
        SearchQueryRequest request,
        Boolean includeNameSearch
    ) {
        String query =
            'SELECT Id, ' +
            String.join(getQueryFields(request.context), ', ') +
            ' FROM ' +
            request.context.config.objectApiName;

        List<String> whereClauses = new List<String>();
        if (includeNameSearch) {
            whereClauses.add(
                request.context.config.nameFieldApiName + ' LIKE :nameSearchTerm'
            );
        }
        if (request.cursor != null) {
            whereClauses.add(
                ObjectRecordSearchSortSupport.createCursorWhereClause(
                    request.sortSpec,
                    request.cursor
                )
            );
        }

        if (!whereClauses.isEmpty()) {
            query += ' WHERE ' + String.join(whereClauses, ' AND ');
        }

        return query +
            ' ORDER BY ' +
            request.sortSpec.fieldApiName +
            ' ' +
            request.sortSpec.direction.toUpperCase() +
            ' NULLS LAST, Id ASC LIMIT ' +
            request.fetchSize;
    }

    private static Boolean usesNameSearch(
        String normalizedSearchTerm,
        ObjectRecordSearchConfigWrapper config
    ) {
        return String.isNotBlank(normalizedSearchTerm) && config.searchable;
    }

    /**
     * 実行する SOQL と bind 値です。
     */
    public class SearchQuery {
        public String soql;
        public Map<String, Object> bindValues;
    }

    /**
     * 検索クエリ計画を作るための入力です。
     */
    public class SearchQueryRequest {
        public ObjectRecordSearchContext context;
        public ObjectRecordSearchRequestWrapper searchRequest;
        public ObjectRecordSearchSortSupport.SortSpec sortSpec;
        public ObjectRecordSearchSortSupport.PageCursor cursor;
        public Integer fetchSize;
    }
}