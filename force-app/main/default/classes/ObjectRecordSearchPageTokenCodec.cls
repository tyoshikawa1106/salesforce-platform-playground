/**
 * 汎用レコード検索のページング token を生成・復元します。
 */
public with sharing class ObjectRecordSearchPageTokenCodec {
    private static final Set<Schema.DisplayType> NUMERIC_DISPLAY_TYPES = new Set<Schema.DisplayType>{
        Schema.DisplayType.CURRENCY,
        Schema.DisplayType.DOUBLE,
        Schema.DisplayType.INTEGER,
        Schema.DisplayType.PERCENT
    };

    /**
     * 現在ページ末尾の行から次ページ取得用 token を作成します。
     * @param rows 現在ページの表示行
     * @param sortSpec ソート条件
     * @return 次ページ取得用 token
     */
    public static String createNextPageToken(
        List<ObjectRecordSearchRowWrapper> rows,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        if (rows == null || rows.isEmpty() || sortSpec == null) {
            return null;
        }

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
     * 次ページ取得用 token をカーソル値に復元します。
     * @param pageToken LWC から受け取ったページ token
     * @param sortSpec 現在のソート条件
     * @return 次ページ取得用カーソル
     */
    public static ObjectRecordSearchSortSupport.PageCursor parsePageToken(
        String pageToken,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
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

    private static ObjectRecordSearchSortSupport.PageCursor createPageCursor(
        Map<String, Object> tokenParts,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        String cursorFieldApiName = getCursorFieldApiName(tokenParts, sortSpec);
        String cursorRecordId = (String) tokenParts.get('recordId');
        if (
            cursorFieldApiName != sortSpec.fieldApiName ||
            String.isBlank(cursorRecordId)
        ) {
            throw createUnreadablePageTokenException(null);
        }

        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.sortValue = parseCursorSortValue(
            getCursorSortValue(tokenParts),
            sortSpec
        );
        cursor.recordId = (Id) cursorRecordId;
        return cursor;
    }

    private static String getCursorFieldApiName(
        Map<String, Object> tokenParts,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
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

    private static String getRowSortValue(
        ObjectRecordSearchRowWrapper row,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        if (sortSpec.fieldApiName == sortSpec.nameFieldApiName) {
            return row.name;
        }
        return row.fieldValues.get(sortSpec.fieldApiName);
    }

    private static Object parseCursorSortValue(
        Object rawValue,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
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
        if (NUMERIC_DISPLAY_TYPES.contains(displayType)) {
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
}
