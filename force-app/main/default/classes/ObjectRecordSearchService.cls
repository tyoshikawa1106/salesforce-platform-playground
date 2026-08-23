/**
 * 汎用レコード検索画面の判定と Wrapper 組み立て提供
 */
public with sharing class ObjectRecordSearchService {

    private static final Integer PAGE_SIZE = 50;
    private static final Integer PAGE_FETCH_SIZE = ObjectRecordSearchQueryPlan.SEARCH_FETCH_SIZE;
    private static final String DELETE_ROW_ERROR_MESSAGE = '削除できないレコードがありました。権限や関連データを確認してください。';

    /**
     * 検索画面の準備または検索条件の判定結果
     */
    public enum ErrorCode {
        NONE,
        UNSUPPORTED_METRIC_KEY,
        OBJECT_UNAVAILABLE,
        OBJECT_ACCESS_DENIED,
        NAME_FIELD_UNAVAILABLE,
        NAME_FIELD_ACCESS_DENIED,
        INVALID_PAGE_TOKEN
    }

    /**
     * 検索画面の内部状態解決結果
     */
    public class SearchContextResult {

        // 正常時に後続処理へ渡す検索状態
        public ObjectRecordSearchContext context;
        // 画面側で案内を選ぶための失敗理由
        public ErrorCode errorCode;

        /**
         * 検索画面の内部状態を利用できるかを返す
         *
         * @return 正常な検索状態を保持する場合 true
         */
        public Boolean isSuccess() {
            return this.errorCode == ObjectRecordSearchService.ErrorCode.NONE &&
                this.context != null;
        }
    }

    /**
     * 検索問い合わせ条件の準備結果
     */
    public class SearchQueryRequestResult {

        // 正常時に Selector と結果変換で共有する検索条件
        public ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest;
        // 画面側で案内を選ぶための失敗理由
        public ErrorCode errorCode;

        /**
         * 検索問い合わせ条件を利用できるかを返す
         *
         * @return 正常な検索条件を保持する場合 true
         */
        public Boolean isSuccess() {
            return this.errorCode == ObjectRecordSearchService.ErrorCode.NONE &&
                this.searchQueryRequest != null;
        }
    }

    /**
     * 表示キーから検索画面の内部状態を解決
     *
     * @param metricKey データボードカードの表示キー
     * @return 検索状態または利用できない理由
     */
    public SearchContextResult resolveSearchContext(String metricKey) {
        SearchContextResult result = new SearchContextResult();
        // 表示キーを固定カタログの検索対象へ変換
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            metricKey
        );
        if (definition == null) {
            result.errorCode = ErrorCode.UNSUPPORTED_METRIC_KEY;
            return result;
        }

        // 動的処理へ渡すオブジェクトを固定カタログに限定
        Boolean isSupportedObject = ObjectMetricCatalog.hasObjectApiName(
            definition.objectApiName
        );
        // 組織内のメタデータから対象 SObjectType を解決
        Map<String, Schema.SObjectType> sObjectTypesByApiName = Schema.getGlobalDescribe();
        Schema.SObjectType sObjectType = sObjectTypesByApiName.get(
            definition.objectApiName
        );
        if (!isSupportedObject || sObjectType == null) {
            result.errorCode = ErrorCode.OBJECT_UNAVAILABLE;
            return result;
        }

        // 現在ユーザーが検索へ利用できるオブジェクトかを判定
        Schema.DescribeSObjectResult objectDescribe = sObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Boolean canSearchObject = objectDescribe.isAccessible() &&
            objectDescribe.isQueryable();
        if (!canSearchObject) {
            result.errorCode = ErrorCode.OBJECT_ACCESS_DENIED;
            return result;
        }

        // 一覧の主表示項目として使える Name 相当項目を解決
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        List<Schema.SObjectField> fieldTokens = fieldsByApiName.values();
        Schema.DescribeFieldResult nameFieldDescribe = findNameFieldDescribe(fieldTokens);
        Schema.SObjectField fallbackNameField = fieldsByApiName.get('Name');
        if (nameFieldDescribe == null) {
            nameFieldDescribe = fallbackNameField?.getDescribe();
        }
        if (nameFieldDescribe == null) {
            result.errorCode = ErrorCode.NAME_FIELD_UNAVAILABLE;
            return result;
        }

        // 主表示項目を参照できる利用者だけに検索状態を提供
        Boolean isNameFieldAccessible = nameFieldDescribe.isAccessible();
        if (!isNameFieldAccessible) {
            result.errorCode = ErrorCode.NAME_FIELD_ACCESS_DENIED;
            return result;
        }

        // 画面へ返す固定表示項目を参照権限で絞り込み
        List<ObjectRecordSearchFieldWrapper> displayFields = ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
            definition.objectApiName,
            objectDescribe
        );
        // 同じ describe 情報から画面設定と内部検索状態を構築
        ObjectRecordSearchConfigWrapper config = createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        );
        config = config.withDisplayFields(displayFields);
        result.context = createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
        result.errorCode = ErrorCode.NONE;
        return result;
    }

    /**
     * 指定レコードを利用者権限で削除
     *
     * @param recordsToDelete 削除対象レコード
     * @return 行ごとの DML 削除結果
     */
    public List<Database.DeleteResult> deleteRecords(List<SObject> recordsToDelete) {
        // null の削除対象を空の List として扱えるよう正規化
        List<SObject> safeRecordsToDelete = recordsToDelete ?? new List<SObject>();
        // 削除対象がない場合は DML を実行せず空結果へ短絡
        if (safeRecordsToDelete.isEmpty()) {
            return new List<Database.DeleteResult>();
        }
        // 画面利用者の権限で部分成功を許容して削除
        return Database.delete(safeRecordsToDelete, false, AccessLevel.USER_MODE);
    }

    /**
     * 検索画面設定を作成
     *
     * @param definition データボードカードと対象オブジェクトの定義
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return 検索画面設定
     */
    public ObjectRecordSearchConfigWrapper createObjectConfig(ObjectMetricCatalog.MetricDefinition definition, Schema.DescribeFieldResult nameFieldDescribe, Schema.DescribeSObjectResult objectDescribe) {
        return new ObjectRecordSearchConfigWrapper(
            definition,
            nameFieldDescribe,
            objectDescribe
        );
    }

    /**
     * 検索画面の内部処理状態を作成
     *
     * @param config LWC に返す検索画面設定
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return 検索画面の内部処理状態
     */
    public ObjectRecordSearchContext createSearchContext(ObjectRecordSearchConfigWrapper config, Schema.DescribeFieldResult nameFieldDescribe, Schema.DescribeSObjectResult objectDescribe) {
        return new ObjectRecordSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
    }

    /**
     * 検索リクエストから安全なソート条件を作成
     * @param context 検索画面の内部処理状態
     * @param request 検索条件とページ指定
     * @return 許可済み項目と方向だけを持つソート条件
     */
    public ObjectRecordSearchSortSupport.SortSpec createSortSpec(ObjectRecordSearchContext context, ObjectRecordSearchRequestWrapper request) {
        return ObjectRecordSearchSortSupport.createSortSpec(context, request);
    }

    /**
     * 検索条件、ソート条件、ページング条件まとめ
     *
     * @param context 検索画面の内部処理状態
     * @param request 検索条件とページ指定
     * @param sortSpec 正規化済みソート条件
     * @return 検索クエリと結果整形で共有する検索条件
     */
    public SearchQueryRequestResult createSearchQueryRequest(ObjectRecordSearchContext context, ObjectRecordSearchRequestWrapper request, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        SearchQueryRequestResult result = new SearchQueryRequestResult();
        // ページトークンを現在のソート条件に対応するカーソルへ変換
        String pageToken = request?.pageToken;
        ObjectRecordSearchPageTokenCodec.ParseResult pageTokenResult = ObjectRecordSearchSortSupport.parsePageToken(
            pageToken,
            sortSpec
        );
        if (!pageTokenResult.isValid) {
            result.errorCode = ErrorCode.INVALID_PAGE_TOKEN;
            return result;
        }

        // Selector と結果整形で共有する検索条件を作成
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        searchQueryRequest.context = context;
        searchQueryRequest.searchRequest = request;
        // 任意の名称フィルターを問い合わせ処理で共有する値へ正規化
        searchQueryRequest.normalizedSearchTerm = request?.searchTerm?.trim();
        searchQueryRequest.sortSpec = sortSpec;
        searchQueryRequest.cursor = pageTokenResult.cursor;
        searchQueryRequest.fetchSize = PAGE_FETCH_SIZE;
        result.searchQueryRequest = searchQueryRequest;
        result.errorCode = ErrorCode.NONE;
        return result;
    }

    /**
     * 検索結果レコードを LWC 返却用 Wrapper に変換
     *
     * @param request 検索クエリと結果整形で共有する検索条件
     * @param records 検索結果 SObject
     * @return 1 ページ最大 50 件の検索結果
     */
    public ObjectRecordSearchResultWrapper createSearchResult(ObjectRecordSearchQueryPlan.SearchQueryRequest request, List<SObject> records) {
        // SOQL 結果を LWC が扱う行 Wrapper へ変換
        List<ObjectRecordSearchRowWrapper> rows = new List<ObjectRecordSearchRowWrapper>();
        for (SObject record : records) {
            ObjectRecordSearchRowWrapper row = new ObjectRecordSearchRowWrapper(
                record,
                request.context.config.nameFieldApiName,
                request.context.config.displayFields
            );
            rows.add(row);
        }
        // 1 件多く取得した結果で次ページ有無を判定
        Boolean hasNextPage = rows.size() > PAGE_SIZE;
        if (hasNextPage) {
            rows.remove(PAGE_SIZE);
        }
        String nextPageToken;
        if (hasNextPage) {
            // 最終表示行から次ページ取得用カーソルを作成
            nextPageToken = ObjectRecordSearchSortSupport.createNextPageToken(
                rows,
                request.sortSpec
            );
        }
        // 表示設定、行、ページ状態を 1 つの返却 Wrapper に集約
        ObjectRecordSearchResultWrapper result = new ObjectRecordSearchResultWrapper(
            request.context.config,
            rows
        );
        // 不正なページ番号は最初のページとして扱う
        Integer pageNumber = normalizePageNumber(
            request.searchRequest?.pageNumber
        );
        result = result.withPageState(
            PAGE_SIZE,
            pageNumber,
            nextPageToken
        );
        return result;
    }

    /**
     * 選択レコードを削除してよいかを返す
     * @param config 検索画面設定
     * @param recordIds 削除するレコード ID
     * @return 削除対象 ID があり、対象オブジェクトを削除可能な場合 true
     */
    public Boolean canDeleteRecords(ObjectRecordSearchConfigWrapper config, List<Id> recordIds) {
        // 設定と削除 ID がそろった場合だけ DML を許可
        Boolean isDeletable = config?.deletable == true;
        // null の削除 ID を空の List として扱えるよう正規化
        List<Id> safeRecordIds = recordIds ?? new List<Id>();
        Boolean hasRecordIds = !safeRecordIds.isEmpty();
        return isDeletable && hasRecordIds;
    }

    /**
     * DML 削除結果を LWC 返却用 Wrapper に変換
     *
     * @param recordIds LWC から削除要求された ID
     * @param deleteResults DML 削除結果
     * @return 削除結果
     */
    public ObjectRecordSearchDeleteWrapper createDeleteResult(List<Id> recordIds, List<Database.DeleteResult> deleteResults) {
        // リクエスト件数は DML 実行有無に関係なく画面へ返す
        List<Id> safeRecordIds = recordIds ?? new List<Id>();
        Integer requestedCount = safeRecordIds.size();
        Integer deletedCount = 0;
        List<String> errors = new List<String>();

        // DML 未実行時の null を空の結果として扱えるよう正規化
        List<Database.DeleteResult> safeDeleteResults = deleteResults ?? new List<Database.DeleteResult>();
        // 重複、対象外、取得不能により DML へ到達しなかった要求件数を算出
        Integer unprocessedCount = Math.max(
            requestedCount - safeDeleteResults.size(),
            0
        );
        // 未処理の要求も削除失敗として利用者へ通知
        for (Integer index = 0; index < unprocessedCount; index++) {
            // DML結果がない要求ごとに画面表示用エラーを追加
            errors.add(DELETE_ROW_ERROR_MESSAGE);
        }
        for (Database.DeleteResult deleteResult : safeDeleteResults) {
            // 成功件数とユーザー向けエラーを DML 結果から集計
            Boolean isDeleteSuccessful = deleteResult.isSuccess();
            if (isDeleteSuccessful) {
                deletedCount++;
                continue;
            }
            errors.add(DELETE_ROW_ERROR_MESSAGE);
        }

        return new ObjectRecordSearchDeleteWrapper(
            requestedCount,
            deletedCount,
            errors
        );
    }

    private Integer normalizePageNumber(Integer pageNumber) {
        return Math.max(pageNumber ?? 1, 1);
    }

    /**
     * 項目 token から Name 相当項目を検索
     *
     * @param fieldTokens 対象オブジェクトの項目 token
     * @return 最初の Name 相当項目、存在しない場合は null
     */
    private Schema.DescribeFieldResult findNameFieldDescribe(List<Schema.SObjectField> fieldTokens) {
        for (Schema.SObjectField fieldToken : fieldTokens) {
            // 項目種別と権限を判定できる describe 結果を取得
            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            // Salesforce が Name 相当として定義した項目かを判定
            Boolean isNameField = fieldDescribe.isNameField();
            if (isNameField) {
                // 最初に見つかった Name 相当項目を検索画面へ採用
                return fieldDescribe;
            }
        }
        // Name 相当項目が存在しないことを呼び出し元へ通知
        return null;
    }
}
