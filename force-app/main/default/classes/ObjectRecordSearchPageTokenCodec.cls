/**
 * 汎用レコード検索のページング token 生成・復元
 */
public with sharing class ObjectRecordSearchPageTokenCodec {
    private static final Set<Schema.DisplayType> NUMERIC_DISPLAY_TYPES = new Set<Schema.DisplayType>{
        Schema.DisplayType.CURRENCY,
        Schema.DisplayType.DOUBLE,
        Schema.DisplayType.INTEGER,
        Schema.DisplayType.PERCENT
    };

    /**
     * 現在ページ末尾の行から次ページ取得用 token を作成
     *
     * @param rows 現在ページの表示行
     * @param sortSpec ソート条件
     * @return 次ページ取得用 token
     */
    public static String createNextPageToken(
        List<ObjectRecordSearchRowWrapper> rows,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        Boolean hasRows = rows != null && !rows.isEmpty();
        if (!hasRows || sortSpec == null) {
            return null;
        }

        Integer lastRowIndex = rows.size() - 1;
        ObjectRecordSearchRowWrapper lastRow = rows[lastRowIndex];
        String recordIdValue = String.valueOf(lastRow.id);
        String rowSortValue = getRowSortValue(lastRow, sortSpec);
        Map<String, String> tokenParts = new Map<String, String>{
            'fieldApiName' => sortSpec.fieldApiName,
            'recordId' => recordIdValue,
            'sortValue' => rowSortValue
        };
        String pageToken = JSON.serialize(tokenParts);
        return pageToken;
    }

    /**
     * 次ページ取得用 token をカーソル値に復元
     *
     * @param pageToken LWC から受け取ったページ token
     * @param sortSpec 現在のソート条件
     * @return 次ページ取得用カーソル、pageToken が空白の場合は null
     * @throws ObjectRecordSearchException token を読み込めない場合
     */
    public static ObjectRecordSearchSortSupport.PageCursor parsePageToken(
        String pageToken,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        Boolean hasPageToken = String.isNotBlank(pageToken);
        if (!hasPageToken) {
            return null;
        }

        try {
            Map<String, Object> tokenParts = parseTokenParts(pageToken);
            ObjectRecordSearchSortSupport.PageCursor cursor = createPageCursor(
                tokenParts,
                sortSpec
            );
            return cursor;
        } catch (ObjectRecordSearchException error) {
            throw error;
        } catch (Exception error) {
            throw createUnreadablePageTokenException(error);
        }
    }

    private static Map<String, Object> parseTokenParts(String pageToken) {
        Map<String, Object> tokenParts = (Map<String, Object>) JSON.deserializeUntyped(
            pageToken
        );
        return tokenParts;
    }

    private static ObjectRecordSearchSortSupport.PageCursor createPageCursor(
        Map<String, Object> tokenParts,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        String cursorFieldApiName = getCursorFieldApiName(tokenParts, sortSpec);
        String cursorRecordId = (String) tokenParts.get('recordId');
        Boolean isCursorFieldExpected = cursorFieldApiName == sortSpec.fieldApiName;
        Boolean hasCursorRecordId = String.isNotBlank(cursorRecordId);
        if (!isCursorFieldExpected || !hasCursorRecordId) {
            throw createUnreadablePageTokenException(null);
        }

        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        Object rawCursorSortValue = getCursorSortValue(tokenParts);
        cursor.sortValue = parseCursorSortValue(rawCursorSortValue, sortSpec);
        cursor.recordId = (Id) cursorRecordId;
        return cursor;
    }

    private static String getCursorFieldApiName(
        Map<String, Object> tokenParts,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        String cursorFieldApiName = (String) tokenParts.get('fieldApiName');
        Boolean hasCursorFieldApiName = String.isNotBlank(cursorFieldApiName);
        return hasCursorFieldApiName ? cursorFieldApiName : sortSpec.fieldApiName;
    }

    private static Object getCursorSortValue(Map<String, Object> tokenParts) {
        String cursorFieldApiName = (String) tokenParts.get('fieldApiName');
        Boolean hasCursorFieldApiName = String.isNotBlank(cursorFieldApiName);
        return hasCursorFieldApiName
            ? tokenParts.get('sortValue')
            : tokenParts.get('name');
    }

    private static String getRowSortValue(
        ObjectRecordSearchRowWrapper row,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        if (sortSpec.fieldApiName == sortSpec.nameFieldApiName) {
            return row.name;
        }
        String sortValue = row.fieldValues.get(sortSpec.fieldApiName);
        return sortValue;
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
        Boolean isNumericDisplayType = NUMERIC_DISPLAY_TYPES.contains(displayType);
        if (isNumericDisplayType) {
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
            ? new ObjectRecordSearchException(
                  'ページ情報を読み込めませんでした。一覧を更新してからもう一度お試しください。'
              )
            : new ObjectRecordSearchException(
                  'ページ情報を読み込めませんでした。一覧を更新してからもう一度お試しください。',
                  cause
              );
    }
}
