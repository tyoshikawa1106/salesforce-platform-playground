/**
 * 汎用レコード検索の安全なクエリ計画組み立て
 */
public with sharing class ObjectRecordSearchQueryPlan {
    /**
     * 検索条件から SOQL と bind 値を作成
     *
     * @param request 検索クエリ計画の作成条件
     * @return 実行可能な検索クエリ計画
     * @throws ObjectRecordSearchException 必須条件が不足する、または許可外のオブジェクト・項目が指定された場合
     */
    public static SearchQuery createSearchQuery(
        SearchQueryRequest request
    ) {
        validateSearchQueryRequest(request);

        SearchQuery query = new SearchQuery();
        query.bindValues = new Map<String, Object>();

        String normalizedSearchTerm = request.searchRequest?.searchTerm?.trim();
        Boolean shouldUseNameSearch = usesNameSearch(
            normalizedSearchTerm,
            request.context.config
        );
        String likeSearchTerm;
        if (shouldUseNameSearch) {
            likeSearchTerm = '%' + normalizedSearchTerm + '%';
            query.bindValues.put('nameSearchTerm', likeSearchTerm);
        }
        if (request.cursor != null) {
            query.bindValues.put('cursorSortValue', request.cursor.sortValue);
            query.bindValues.put('cursorRecordId', request.cursor.recordId);
        }

        Boolean hasLikeSearchTerm = likeSearchTerm != null;
        query.soql = buildSearchSoql(request, hasLikeSearchTerm);
        return query;
    }

    /**
     * 検索時に SELECT する項目 API 参照名を返す
     *
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
        List<String> queryFields = getQueryFields(request.context);
        String selectedFields = String.join(queryFields, ', ');
        String query =
            'SELECT Id, ' +
            selectedFields +
            ' FROM ' +
            request.context.config.objectApiName;

        List<String> whereClauses = new List<String>();
        if (includeNameSearch) {
            whereClauses.add(
                request.context.config.nameFieldApiName + ' LIKE :nameSearchTerm'
            );
        }
        if (request.cursor != null) {
            String cursorWhereClause = ObjectRecordSearchSortSupport.createCursorWhereClause(
                request.sortSpec,
                request.cursor
            );
            whereClauses.add(cursorWhereClause);
        }

        Boolean hasWhereClauses = !whereClauses.isEmpty();
        if (hasWhereClauses) {
            String joinedWhereClauses = String.join(whereClauses, ' AND ');
            query += ' WHERE ' + joinedWhereClauses;
        }

        String sortDirection = request.sortSpec.direction.toUpperCase();
        String soql = query +
            ' ORDER BY ' +
            request.sortSpec.fieldApiName +
            ' ' +
            sortDirection +
            ' NULLS LAST, Id ASC LIMIT ' +
            request.fetchSize;
        return soql;
    }

    private static Boolean usesNameSearch(
        String normalizedSearchTerm,
        ObjectRecordSearchConfigWrapper config
    ) {
        Boolean hasSearchTerm = String.isNotBlank(normalizedSearchTerm);
        return hasSearchTerm && config.searchable;
    }

    private static void validateSearchQueryRequest(
        SearchQueryRequest request
    ) {
        Boolean hasRequiredParts = hasRequiredSearchQueryParts(request);
        if (!hasRequiredParts) {
            throw new ObjectRecordSearchException(
                '検索条件を処理できませんでした。条件を見直して、もう一度お試しください。'
            );
        }

        Boolean isSupportedObject = isSupportedObject(
            request.context.config.objectApiName
        );
        Boolean isAllowedSortField = isAllowedSortField(
            request.context,
            request.sortSpec
        );
        if (!isSupportedObject || !isAllowedSortField) {
            throw new ObjectRecordSearchException(
                '検索条件を処理できませんでした。条件を見直して、もう一度お試しください。'
            );
        }
    }

    private static Boolean hasRequiredSearchQueryParts(
        SearchQueryRequest request
    ) {
        return request != null &&
            request.context != null &&
            request.context.config != null &&
            request.sortSpec != null &&
            request.fetchSize != null &&
            request.fetchSize > 0;
    }

    private static Boolean isSupportedObject(String objectApiName) {
        Boolean hasObjectApiName = ObjectMetricCatalog.hasObjectApiName(
            objectApiName
        );
        return hasObjectApiName;
    }

    private static Boolean isAllowedSortField(
        ObjectRecordSearchContext context,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        Set<String> allowedFieldApiNames = context.getAllowedFieldApiNames();
        Boolean hasAllowedField = allowedFieldApiNames.contains(
            sortSpec.fieldApiName
        );
        return hasAllowedField;
    }

    /**
     * 実行する SOQL と bind 値
     */
    public class SearchQuery {
        public String soql;
        public Map<String, Object> bindValues;
    }

    /**
     * 検索クエリ計画を作るための入力
     */
    public class SearchQueryRequest {
        public ObjectRecordSearchContext context;
        public ObjectRecordSearchRequestWrapper searchRequest;
        public ObjectRecordSearchSortSupport.SortSpec sortSpec;
        public ObjectRecordSearchSortSupport.PageCursor cursor;
        public Integer fetchSize;
    }
}
