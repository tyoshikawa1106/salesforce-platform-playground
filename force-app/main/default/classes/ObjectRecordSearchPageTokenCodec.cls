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
    public static String createNextPageToken(List<ObjectRecordSearchRowWrapper> rows, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        // 行またはソート条件がない場合は次ページなしとして扱う
        Boolean hasRows = rows != null && !rows.isEmpty();
        if (!hasRows || sortSpec == null) {
            return null;
        }
        // 現在ページ末尾の行を次ページ取得境界にする
        Integer lastRowIndex = rows.size() - 1;
        ObjectRecordSearchRowWrapper lastRow = rows[lastRowIndex];
        String recordIdValue = String.valueOf(lastRow.id);
        String rowSortValue = getRowSortValue(lastRow, sortSpec);
        Map<String, String> tokenParts = new Map<String, String>{
            'objectApiName' => sortSpec.objectApiName,
            'fieldApiName' => sortSpec.fieldApiName,
            'sortDirection' => sortSpec.direction,
            'recordId' => recordIdValue,
            'sortValue' => rowSortValue
        };
        // token は LWC が保持しやすい JSON 文字列にする
        String pageToken = JSON.serialize(tokenParts);
        return pageToken;
    }

    /**
     * 次ページ取得用 token をカーソル値に復元
     *
     * @param pageToken LWC から受け取ったページ token
     * @param sortSpec 現在のソート条件
     * @return token の有効性と次ページ取得用カーソル
     * @throws IllegalArgumentException 内部のソート条件が解析契約を満たさない場合
     */
    public static ParseResult parsePageToken(String pageToken, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        // 内部で確定済みのソート条件が欠けた場合は利用者入力の不正として扱わない
        requireValidSortSpec(sortSpec);
        ParseResult result = new ParseResult();
        // 空白 token は先頭ページとして扱う
        Boolean hasPageToken = String.isNotBlank(pageToken);
        if (!hasPageToken) {
            result.isValid = true;
            return result;
        }

        try {
            // JSON token を現在の sortSpec で使えるカーソルへ変換
            Map<String, Object> tokenParts = parseTokenParts(pageToken);
            result.cursor = createPageCursor(
                tokenParts,
                sortSpec
            );
            result.isValid = result.cursor != null;
        } catch (JSONException e) {
            // JSONとして読み取れない外部入力を無効なtokenへ正規化
            result.isValid = false;
        } catch (TypeException e) {
            // token値の型や書式が現在のソート項目と合わない場合は再利用しない
            result.isValid = false;
        } catch (StringException e) {
            // Salesforce IDへ変換できない外部入力を無効なtokenへ正規化
            result.isValid = false;
        }
        return result;
    }

    private static void requireValidSortSpec(ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        Boolean hasRequiredSortSpec = sortSpec != null &&
            String.isNotBlank(sortSpec.objectApiName) &&
            String.isNotBlank(sortSpec.fieldApiName) &&
            String.isNotBlank(sortSpec.direction) &&
            sortSpec.fieldDescribe != null;
        if (!hasRequiredSortSpec) {
            throw new IllegalArgumentException('ページトークンの解析には検証済みのソート条件が必要です。');
        }
    }

    private static Map<String, Object> parseTokenParts(String pageToken) {
        Map<String, Object> tokenParts = (Map<String, Object>) JSON.deserializeUntyped(
            pageToken
        );
        return tokenParts;
    }

    private static ObjectRecordSearchSortSupport.PageCursor createPageCursor(Map<String, Object> tokenParts, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        // JSON object以外はページ境界を構成できない外部入力として拒否
        if (tokenParts == null) {
            return null;
        }
        // token の対象オブジェクトを現在の検索条件と照合
        String cursorObjectApiName = (String) tokenParts.get('objectApiName');
        // token の field と現在の sortSpec がずれた場合は読み込み不可
        String cursorFieldApiName = (String) tokenParts.get('fieldApiName');
        // token 発行時と現在のソート方向を比較できる値を取得
        String cursorSortDirection = (String) tokenParts.get('sortDirection');
        String cursorRecordId = (String) tokenParts.get('recordId');
        Boolean isCursorObjectExpected = cursorObjectApiName == sortSpec.objectApiName;
        Boolean isCursorFieldExpected = cursorFieldApiName == sortSpec.fieldApiName;
        // ソート方向が欠落または変更された token を別の問い合わせで再利用させない
        Boolean isCursorDirectionExpected = cursorSortDirection == sortSpec.direction;
        Boolean hasCursorRecordId = String.isNotBlank(cursorRecordId);
        if (!isCursorObjectExpected || !isCursorFieldExpected || !isCursorDirectionExpected || !hasCursorRecordId) {
            return null;
        }
        // 構文上有効な ID も現在の検索対象オブジェクトに限定
        Id cursorRecordIdValue = (Id) cursorRecordId;
        String cursorRecordObjectApiName = cursorRecordIdValue.getSObjectType().getDescribe().getName();
        Boolean isCursorRecordObjectExpected = cursorRecordObjectApiName == sortSpec.objectApiName;
        if (!isCursorRecordObjectExpected) {
            return null;
        }
        // SOQL bind に渡せる型へ sort 値を復元
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        // 検証済み形式から第1ソートキーの境界値を取得
        Object rawCursorSortValue = tokenParts.get('sortValue');
        cursor.sortValue = parseCursorSortValue(rawCursorSortValue, sortSpec);
        cursor.recordId = cursorRecordIdValue;
        return cursor;
    }

    private static String getRowSortValue(ObjectRecordSearchRowWrapper row, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        if (sortSpec.fieldApiName == sortSpec.nameFieldApiName) {
            return row.name;
        }
        // 表示項目でソートしている場合は行の fieldValues から境界値を取る
        String sortValue = row.fieldValues.get(sortSpec.fieldApiName);
        return sortValue;
    }

    private static Object parseCursorSortValue(Object rawValue, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        if (rawValue == null) {
            return null;
        }
        // describe 型に合わせて SOQL bind 用の値へ戻す
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

    /**
     * ページトークンの解析結果
     */
    public class ParseResult {

        // 現在の検索条件でトークンを利用できるかどうか
        public Boolean isValid;
        // 有効なトークンから復元した次ページ境界
        public ObjectRecordSearchSortSupport.PageCursor cursor;
    }
}
