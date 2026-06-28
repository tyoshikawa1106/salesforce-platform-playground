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
        String fieldApiName = getSortFieldApiName(context, request);
        Schema.DescribeFieldResult fieldDescribe = context.getAllowedFieldDescribe(
            fieldApiName
        );
        if (!fieldDescribe.isSortable()) {
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
        ObjectRecordSearchRowWrapper lastRow = rows[
            rows.size() - 1
        ];
        return JSON.serialize(
            new Map<String, String>{
                'fieldApiName' => sortSpec.fieldApiName,
                'recordId' => String.valueOf(lastRow.id),
                'sortValue' => getRowSortValue(lastRow, sortSpec)
            }
        );
    }

    /**
     * カーソルトークンを読み込みます。
     * @param pageToken LWC から受け取ったページトークン
     * @param sortSpec 現在のソート条件
     * @return 次ページ取得用カーソル
     */
    public static PageCursor parsePageToken(String pageToken, SortSpec sortSpec) {
        if (String.isBlank(pageToken)) {
            return null;
        }

        try {
            return createPageCursor(parseTokenParts(pageToken), sortSpec);
        } catch (ObjectRecordSearchException error) {
            throw error;
        } catch (Exception error) {
            throw createUnreadablePageTokenException(error);
        }
    }

    private static Map<String, Object> parseTokenParts(String pageToken) {
        return (Map<String, Object>) JSON.deserializeUntyped(pageToken);
    }

    private static PageCursor createPageCursor(
        Map<String, Object> tokenParts,
        SortSpec sortSpec
    ) {
        String cursorFieldApiName = getCursorFieldApiName(tokenParts, sortSpec);
        String cursorRecordId = (String) tokenParts.get('recordId');
        if (
            cursorFieldApiName != sortSpec.fieldApiName ||
            String.isBlank(cursorRecordId)
        ) {
            throw createUnreadablePageTokenException(null);
        }

        PageCursor cursor = new PageCursor();
        cursor.sortValue = parseCursorSortValue(
            getCursorSortValue(tokenParts),
            sortSpec
        );
        cursor.recordId = (Id) cursorRecordId;
        return cursor;
    }

    private static String getCursorFieldApiName(
        Map<String, Object> tokenParts,
        SortSpec sortSpec
    ) {
        String cursorFieldApiName = (String) tokenParts.get('fieldApiName');
        return String.isBlank(cursorFieldApiName)
            ? sortSpec.fieldApiName
            : cursorFieldApiName;
    }

    private static Object getCursorSortValue(Map<String, Object> tokenParts) {
        return String.isBlank((String) tokenParts.get('fieldApiName'))
            ? tokenParts.get('name')
            : tokenParts.get('sortValue');
    }

    private static String getSortFieldApiName(
        ObjectRecordSearchContext context,
        ObjectRecordSearchRequestWrapper request
    ) {
        return context.getAllowedFieldApiNames().contains(request?.sortBy)
            ? request.sortBy
            : context.config.nameFieldApiName;
    }

    private static String getSortDirection(
        ObjectRecordSearchRequestWrapper request
    ) {
        return request?.sortDirection?.toLowerCase() == SORT_DESCENDING
            ? SORT_DESCENDING
            : SORT_ASCENDING;
    }

    private static String getRowSortValue(
        ObjectRecordSearchRowWrapper row,
        SortSpec sortSpec
    ) {
        if (sortSpec.fieldApiName == sortSpec.nameFieldApiName) {
            return row.name;
        }
        return row.fieldValues.get(sortSpec.fieldApiName);
    }

    private static Object parseCursorSortValue(
        Object rawValue,
        SortSpec sortSpec
    ) {
        if (rawValue == null) {
            return null;
        }

        String stringValue = String.valueOf(rawValue);
        Schema.DisplayType displayType = sortSpec.fieldDescribe.getType();
        if (displayType == Schema.DisplayType.DATE) {
            return Date.valueOf(stringValue);
        }
        if (displayType == Schema.DisplayType.DATETIME) {
            return Datetime.valueOf(stringValue);
        }
        if (
            displayType == Schema.DisplayType.CURRENCY ||
            displayType == Schema.DisplayType.DOUBLE ||
            displayType == Schema.DisplayType.INTEGER ||
            displayType == Schema.DisplayType.PERCENT
        ) {
            return Decimal.valueOf(stringValue);
        }
        if (displayType == Schema.DisplayType.BOOLEAN) {
            return Boolean.valueOf(stringValue);
        }

        return stringValue;
    }

    private static ObjectRecordSearchException createUnreadablePageTokenException(
        Exception cause
    ) {
        return cause == null
            ? new ObjectRecordSearchException('ページ指定を読み込めません。')
            : new ObjectRecordSearchException(
                  'ページ指定を読み込めません。',
                  cause
              );
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