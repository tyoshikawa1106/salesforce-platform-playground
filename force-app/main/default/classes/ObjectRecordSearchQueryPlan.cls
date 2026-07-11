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
    public static SearchQuery createSearchQuery(SearchQueryRequest request) {
        // 動的 SOQL に渡す前に対象オブジェクトとソート項目を検証
        validateSearchQueryRequest(request);
        SearchQuery query = new SearchQuery();
        query.bindValues = new Map<String, Object>();
        // 空白だけの検索語は名称検索条件から除外
        String normalizedSearchTerm = request.searchRequest?.searchTerm?.trim();
        Boolean shouldUseNameSearch = usesNameSearch(
            normalizedSearchTerm,
            request.context.config
        );
        String likeSearchTerm;
        if (shouldUseNameSearch) {
            // LIKE 条件は bind 値で渡して SOQL 文字列へ埋め込まない
            likeSearchTerm = '%' + normalizedSearchTerm + '%';
            query.bindValues.put('nameSearchTerm', likeSearchTerm);
        }
        if (request.cursor != null) {
            // 次ページ境界の値を bind 値として渡す
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
    public static List<String> getQueryFields(ObjectRecordSearchContext context) {
        return context.getQueryFieldApiNames();
    }

    private static String buildSearchSoql(SearchQueryRequest request, Boolean includeNameSearch) {
        // Name 項目と表示項目を重複なしで SELECT 対象にする
        List<String> queryFields = getQueryFields(request.context);
        String selectedFields = String.join(queryFields, ', ');
        String query =
            'SELECT Id, ' +
            selectedFields +
            ' FROM ' +
            request.context.config.objectApiName;
        List<String> whereClauses = new List<String>();
        if (includeNameSearch) {
            // 検索語がある場合だけ Name 相当項目の LIKE 条件を追加
            whereClauses.add(
                request.context.config.nameFieldApiName + ' LIKE :nameSearchTerm'
            );
        }
        if (request.cursor != null) {
            // 次ページ取得時は前ページ末尾より後ろの行だけを取得
            String cursorWhereClause = ObjectRecordSearchSortSupport.createCursorWhereClause(
                request.sortSpec,
                request.cursor
            );
            whereClauses.add(cursorWhereClause);
        }
        Boolean hasWhereClauses = !whereClauses.isEmpty();
        if (hasWhereClauses) {
            // 検索語条件とカーソル条件を同じ WHERE 句にまとめる
            String joinedWhereClauses = String.join(whereClauses, ' AND ');
            query += ' WHERE ' + joinedWhereClauses;
        }
        // Id を第 2 ソートキーにしてページング境界を安定化
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

    private static Boolean usesNameSearch(String normalizedSearchTerm, ObjectRecordSearchConfigWrapper config) {
        // 検索語があり対象項目が検索可能な場合だけ LIKE 条件を使う
        Boolean hasSearchTerm = String.isNotBlank(normalizedSearchTerm);
        return hasSearchTerm && config.searchable;
    }

    private static void validateSearchQueryRequest(SearchQueryRequest request) {
        // クエリ計画に必要な context、sort、fetchSize の欠落を検出
        Boolean hasRequiredParts = hasRequiredSearchQueryParts(request);
        if (!hasRequiredParts) {
            throw new ObjectRecordSearchException('検索条件を処理できませんでした。条件を見直して、もう一度お試しください。');
        }
        Boolean isSupportedObject = isSupportedObject(
            request.context.config.objectApiName
        );
        // 許可済み項目以外で ORDER BY しないよう検証
        Boolean isAllowedSortField = isAllowedSortField(
            request.context,
            request.sortSpec
        );
        if (!isSupportedObject || !isAllowedSortField) {
            throw new ObjectRecordSearchException('検索条件を処理できませんでした。条件を見直して、もう一度お試しください。');
        }
    }

    private static Boolean hasRequiredSearchQueryParts(SearchQueryRequest request) {
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

    private static Boolean isAllowedSortField(ObjectRecordSearchContext context, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
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