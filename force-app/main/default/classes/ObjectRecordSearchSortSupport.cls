/**
 * 汎用レコード検索のソート条件とページングカーソルを扱います。
 */
public with sharing class ObjectRecordSearchSortSupport {
    private static final String SORT_ASCENDING = 'asc';
    private static final String SORT_DESCENDING = 'desc';

    /**
     * リクエストから安全なソート条件を作成します。
     * @param context 検索画面の内部処理状態
     * @param request 検索リクエスト
     * @return 許可済み項目と方向だけを持つソート条件
     */
    public static SortSpec createSortSpec(
        ObjectRecordSearchContext context,
        ObjectRecordSearchRequestWrapper request
    ) {
        if (context == null || context.config == null) {
            throw new ObjectRecordSearchException(
                '検索条件を作成できません。'
            );
        }

        String fieldApiName = getSortFieldApiName(context, request);
        Schema.DescribeFieldResult fieldDescribe = context.getAllowedFieldDescribe(
            fieldApiName
        );
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
     * 次ページ取得用の WHERE 条件を作成します。
     * @param sortSpec ソート条件
     * @param cursor 現在ページ末尾のカーソル
     * @return SOQL の WHERE 句へ追加するカーソル条件
     */
    public static String createCursorWhereClause(
        SortSpec sortSpec,
        PageCursor cursor
    ) {
        if (cursor.sortValue == null) {
            return '(' +
                sortSpec.fieldApiName +
                ' = NULL AND Id > :cursorRecordId)';
        }

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
     * 次ページ取得用のカーソルトークンを作成します。
     * @param rows 現在ページの表示行
     * @param sortSpec ソート条件
     * @return 次ページ取得用トークン
     */
    public static String createNextPageToken(
        List<ObjectRecordSearchRowWrapper> rows,
        SortSpec sortSpec
    ) {
        String nextPageToken = ObjectRecordSearchPageTokenCodec.createNextPageToken(
            rows,
            sortSpec
        );
        return nextPageToken;
    }

    /**
     * カーソルトークンを読み込みます。
     * @param pageToken LWC から受け取ったページトークン
     * @param sortSpec 現在のソート条件
     * @return 次ページ取得用カーソル
     */
    public static PageCursor parsePageToken(String pageToken, SortSpec sortSpec) {
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
        Set<String> allowedFieldApiNames = context.getAllowedFieldApiNames();
        Boolean hasAllowedSortField = allowedFieldApiNames.contains(
            request?.sortBy
        );
        return hasAllowedSortField ? request.sortBy : context.config.nameFieldApiName;
    }

    private static String getSortDirection(
        ObjectRecordSearchRequestWrapper request
    ) {
        String normalizedSortDirection = request?.sortDirection?.toLowerCase();
        return normalizedSortDirection == SORT_DESCENDING
            ? SORT_DESCENDING
            : SORT_ASCENDING;
    }

    /**
     * 正規化済みのソート条件です。
     */
    public class SortSpec {
        public String fieldApiName;
        public String direction;
        public Schema.DescribeFieldResult fieldDescribe;
        public String nameFieldApiName;
    }

    /**
     * ページングに使う現在ページ末尾の値です。
     */
    public class PageCursor {
        public Object sortValue;
        public Id recordId;
    }
}
