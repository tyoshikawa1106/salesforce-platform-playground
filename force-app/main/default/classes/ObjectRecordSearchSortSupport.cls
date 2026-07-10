/**
 * 汎用レコード検索のソート条件とページングカーソル取り扱い
 */
public with sharing class ObjectRecordSearchSortSupport {
    private static final String SORT_ASCENDING = 'asc';
    private static final String SORT_DESCENDING = 'desc';

    /**
     * リクエストから安全なソート条件を作成
     *
     * @param context 検索画面の内部処理状態
     * @param request 検索リクエスト
     * @return 許可済み項目と方向だけを持つソート条件
     * @throws ObjectRecordSearchException context または config が不足している場合
     */
    public static SortSpec createSortSpec(
        ObjectRecordSearchContext context,
        ObjectRecordSearchRequestWrapper request
    ) {
        if (context == null || context.config == null) {
            throw new ObjectRecordSearchException(
                '検索条件を処理できませんでした。条件を見直して、もう一度お試しください。'
            );
        }
        // 許可済み項目だけをソート対象に採用
        String fieldApiName = getSortFieldApiName(context, request);
        Schema.DescribeFieldResult fieldDescribe = context.getAllowedFieldDescribe(
            fieldApiName
        );
        // ソート不可項目は Name 相当項目へフォールバック
        Boolean isFieldSortable = fieldDescribe.isSortable();
        if (!isFieldSortable) {
            fieldApiName = context.config.nameFieldApiName;
            fieldDescribe = context.getAllowedFieldDescribe(fieldApiName);
        }
        SortSpec sortSpec = new SortSpec();
        sortSpec.fieldApiName = fieldApiName;
        sortSpec.direction = getSortDirection(request);
        sortSpec.fieldDescribe = fieldDescribe;
        sortSpec.nameFieldApiName = context.config.nameFieldApiName;
        return sortSpec;
    }

    /**
     * 次ページ取得用の WHERE 条件を作成
     *
     * @param sortSpec ソート条件
     * @param cursor 現在ページ末尾のカーソル
     * @return SOQL の WHERE 句へ追加するカーソル条件
     */
    public static String createCursorWhereClause(
        SortSpec sortSpec,
        PageCursor cursor
    ) {
        if (cursor.sortValue == null) {
            // null 値ソートでは Id だけで次ページ境界を進める
            return '(' +
                sortSpec.fieldApiName +
                ' = NULL AND Id > :cursorRecordId)';
        }
        // 昇順と降順でカーソル境界の比較演算子を切り替え
        String sortOperator = sortSpec.direction == SORT_DESCENDING ? '<' : '>';
        return '(' +
            sortSpec.fieldApiName +
            ' ' +
            sortOperator +
            ' :cursorSortValue OR (' +
            sortSpec.fieldApiName +
            ' = :cursorSortValue AND Id > :cursorRecordId) OR ' +
            sortSpec.fieldApiName +
            ' = NULL)';
    }

    /**
     * 次ページ取得用のカーソルトークンを作成
     * @param rows 現在ページの表示行
     * @param sortSpec ソート条件
     * @return 次ページ取得用トークン、行またはソート条件がない場合は null
     */
    public static String createNextPageToken(
        List<ObjectRecordSearchRowWrapper> rows,
        SortSpec sortSpec
    ) {
        // 最終行のソート値と Id を次ページ token に変換
        String nextPageToken = ObjectRecordSearchPageTokenCodec.createNextPageToken(
            rows,
            sortSpec
        );
        return nextPageToken;
    }

    /**
     * カーソルトークン読み込み
     * @param pageToken LWC から受け取ったページトークン
     * @param sortSpec 現在のソート条件
     * @return 次ページ取得用カーソル、pageToken が空白の場合は null
     */
    public static PageCursor parsePageToken(String pageToken, SortSpec sortSpec) {
        // LWC から戻った token を現在のソート条件に対応するカーソルへ復元
        PageCursor cursor = ObjectRecordSearchPageTokenCodec.parsePageToken(
            pageToken,
            sortSpec
        );
        return cursor;
    }

    private static String getSortFieldApiName(
        ObjectRecordSearchContext context,
        ObjectRecordSearchRequestWrapper request
    ) {
        // リクエスト指定が許可済みでない場合は Name 相当項目で並べる
        Set<String> allowedFieldApiNames = context.getAllowedFieldApiNames();
        Boolean hasAllowedSortField = allowedFieldApiNames.contains(
            request?.sortBy
        );
        return hasAllowedSortField ? request.sortBy : context.config.nameFieldApiName;
    }

    private static String getSortDirection(
        ObjectRecordSearchRequestWrapper request
    ) {
        // desc 以外は既定の昇順として扱う
        String normalizedSortDirection = request?.sortDirection?.toLowerCase();
        return normalizedSortDirection == SORT_DESCENDING
            ? SORT_DESCENDING
            : SORT_ASCENDING;
    }

    /**
     * 正規化済みのソート条件
     */
    public class SortSpec {
        public String fieldApiName;
        public String direction;
        public Schema.DescribeFieldResult fieldDescribe;
        public String nameFieldApiName;
    }

    /**
     * ページングに使う現在ページ末尾の値
     */
    public class PageCursor {
        public Object sortValue;
        public Id recordId;
    }
}
