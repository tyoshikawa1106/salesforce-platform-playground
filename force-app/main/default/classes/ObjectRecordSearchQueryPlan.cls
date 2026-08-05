/**
 * 汎用レコード検索で共有する問い合わせ条件の保持と検証
 */
public with sharing class ObjectRecordSearchQueryPlan {

    // 1 ページ 50 件と次ページ判定用 1 件を取得する固定件数
    public static final Integer SEARCH_FETCH_SIZE = 51;
    // 動的 ORDER BY に使用できる昇順値
    private static final String SORT_ASCENDING = 'asc';
    // 動的 ORDER BY に使用できる降順値
    private static final String SORT_DESCENDING = 'desc';

    /**
     * Selector に渡す問い合わせ条件を検証
     *
     * @param request 検索対象、ソート、ページングを持つ問い合わせ条件
     * @return 検証済みの問い合わせ条件
     * @throws ObjectRecordSearchException 必須条件が不足する、または許可外のオブジェクト・項目が指定された場合
     */
    public static SearchQueryRequest requireValidSearchQueryRequest(SearchQueryRequest request) {
        // クエリ計画に必要な context、sort、fetchSize の欠落を検出
        Boolean hasRequiredParts = hasRequiredSearchQueryParts(request);
        // 必須条件が欠けた問い合わせは Selector へ渡さない
        if (!hasRequiredParts) {
            throw new ObjectRecordSearchException('検索条件を処理できませんでした。条件を見直して、もう一度お試しください。');
        }
        // 動的 SOQL の FROM 句に使える固定カタログのオブジェクトかを判定
        Boolean isSupportedObject = isSupportedObject(
            request.context.config.objectApiName
        );
        // 許可済み項目以外で ORDER BY しないよう検証
        Boolean isAllowedSortField = isAllowedSortField(
            request.context,
            request.sortSpec
        );
        // ORDER BY に埋め込む方向を asc または desc に限定
        Boolean isAllowedSortDirection = isAllowedSortDirection(
            request.sortSpec
        );
        // 許可リスト外の識別子を含む問い合わせを拒否
        if (!isSupportedObject || !isAllowedSortField || !isAllowedSortDirection) {
            throw new ObjectRecordSearchException('検索条件を処理できませんでした。条件を見直して、もう一度お試しください。');
        }
        // Selector が SOQL 組み立てに使える検証済み条件を返却
        return request;
    }

    private static Boolean hasRequiredSearchQueryParts(SearchQueryRequest request) {
        return request != null &&
            request.context != null &&
            request.context.config != null &&
            request.sortSpec != null &&
            request.fetchSize == SEARCH_FETCH_SIZE;
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

    private static Boolean isAllowedSortDirection(ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        // 正規化済みの昇順または降順だけを動的 SOQL へ許可
        Boolean hasAllowedDirection = sortSpec.direction == SORT_ASCENDING ||
            sortSpec.direction == SORT_DESCENDING;
        return hasAllowedDirection;
    }

    /**
     * 検索と結果整形で共有する問い合わせ条件
     */
    public class SearchQueryRequest {

        // 許可済みオブジェクトと表示項目を持つ検索状態
        public ObjectRecordSearchContext context;
        // 検索語と画面表示用ページ番号を持つリクエスト
        public ObjectRecordSearchRequestWrapper searchRequest;
        // Service が前後空白を除去した任意の名称検索語
        public String normalizedSearchTerm;
        // 許可済み項目と方向を持つソート条件
        public ObjectRecordSearchSortSupport.SortSpec sortSpec;
        // 次ページの開始位置を持つカーソル
        public ObjectRecordSearchSortSupport.PageCursor cursor;
        // 次ページ判定用の追加 1 件を含む取得件数
        public Integer fetchSize;
    }
}
