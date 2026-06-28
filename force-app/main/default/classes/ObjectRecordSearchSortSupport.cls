/**
 * 汎用レコード検索のソート条件とページングカーソルを扱います。
 */
public with sharing class ObjectRecordSearchSortSupport {
    private static final String SORT_ASCENDING = 'asc';
    private static final String SORT_DESCENDING = 'desc';

    /**
     * リクエストから安全なソート条件を作成します。
     * @param config 検索画面設定
     * @param request 検索リクエスト
     * @return 許可済み項目と方向だけを持つソート条件
     */
    public static SortSpec createSortSpec(
        ObjectRecordSearchConfigWrapper config,
        ObjectRecordSearchRequestWrapper request
    ) {
        Map<String, Schema.SObjectField> fieldsByApiName = Schema.getGlobalDescribe()
            .get(config.objectApiName)
            .getDescribe(SObjectDescribeOptions.DEFERRED)
            .fields.getMap();
        String fieldApiName = getSortFieldApiName(config, request);
        Schema.DescribeFieldResult fieldDescribe = fieldsByApiName.get(
                fieldApiName
            )
            .getDescribe();
        if (!fieldDescribe.isSortable()) {
            fieldApiName = config.nameFieldApiName;
            fieldDescribe = fieldsByApiName.get(fieldApiName).getDescribe();
        }

        SortSpec sortSpec = new SortSpec();
        sortSpec.fieldApiName = fieldApiName;
        sortSpec.direction = getSortDirection(request);
        sortSpec.fieldDescribe = fieldDescribe;
        sortSpec.nameFieldApiName = config.nameFieldApiName;
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

        Map<String, Object> tokenParts = (Map<String, Object>) JSON.deserializeUntyped(
            pageToken
        );
        String cursorFieldApiName = (String) tokenParts.get('fieldApiName');
        String cursorRecordId = (String) tokenParts.get('recordId');
        Object cursorSortValue = tokenParts.get('sortValue');
        if (String.isBlank(cursorFieldApiName)) {
            cursorFieldApiName = sortSpec.fieldApiName;
            cursorSortValue = tokenParts.get('name');
        }
        if (
            cursorFieldApiName != sortSpec.fieldApiName ||
            String.isBlank(cursorRecordId)
        ) {
            throw new ObjectRecordSearchException(
                'ページ指定を読み込めません。'
            );
        }

        PageCursor cursor = new PageCursor();
        cursor.sortValue = parseCursorSortValue(cursorSortValue, sortSpec);
        cursor.recordId = (Id) cursorRecordId;
        return cursor;
    }

    private static String getSortFieldApiName(
        ObjectRecordSearchConfigWrapper config,
        ObjectRecordSearchRequestWrapper request
    ) {
        return ObjectRecordSearchQueryPlan.getAllowedFieldApiNames(config)
                .contains(request?.sortBy)
            ? request.sortBy
            : config.nameFieldApiName;
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
