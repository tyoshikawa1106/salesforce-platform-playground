/**
 * 汎用レコード検索画面の判定と Wrapper 組み立て提供
 */
public with sharing class ObjectRecordSearchService {

    private static final Integer PAGE_SIZE = 50;
    private static final Integer PAGE_FETCH_SIZE = ObjectRecordSearchQueryPlan.SEARCH_FETCH_SIZE;
    private static final String DELETE_ROW_ERROR_MESSAGE = '削除できないレコードがありました。権限や関連データを確認してください。';

    /**
     * 表示キーに対応するデータボード定義を返す
     *
     * @param metricKey データボードカードの表示キー
     * @return データボードカードと対象オブジェクトの定義
     * @throws ObjectRecordSearchException 表示キーに対応する定義がない場合
     */
    public ObjectMetricCatalog.MetricDefinition requireDefinition(String metricKey) {
        // 表示キーを検索対象オブジェクトのカタログ定義へ変換
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            metricKey
        );
        if (definition == null) {
            throw new ObjectRecordSearchException('このカードのレコード一覧は表示できません。別のカードを選択してください。');
        }
        return definition;
    }

    /**
     * 対象オブジェクトの describe 結果を検証して返却
     *
     * @param objectApiName 対象オブジェクト API 参照名
     * @return 参照可能でクエリ可能なオブジェクトの describe 結果
     * @throws ObjectRecordSearchException 対象オブジェクトを検索できない場合
     */
    public Schema.DescribeSObjectResult getObjectDescribe(String objectApiName) {
        // カタログ定義済みオブジェクトだけを describe 対象に許可
        Boolean isSupportedObject = ObjectMetricCatalog.hasObjectApiName(objectApiName);
        if (!isSupportedObject) {
            throw new ObjectRecordSearchException('このカードの対象オブジェクトを利用できません。別のカードを選択してください。');
        }
        // API 参照名を describe 対象の SObjectType へ解決
        Map<String, Schema.SObjectType> sObjectTypesByApiName = Schema.getGlobalDescribe();
        // カタログと組織の双方に存在する SObjectType を取得
        Schema.SObjectType sObjectType = sObjectTypesByApiName.get(objectApiName);
        if (sObjectType == null) {
            throw new ObjectRecordSearchException('このカードの対象オブジェクトを利用できません。別のカードを選択してください。');
        }
        // 権限とクエリ可否を評価する describe 結果を取得
        Schema.DescribeSObjectResult objectDescribe = sObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        // 参照権限とクエリ可能性を必須条件としてまとめる
        List<Boolean> objectAccessConditions = new List<Boolean>{
            objectDescribe.isAccessible(),
            objectDescribe.isQueryable()
        };
        // いずれかの必須条件を満たさないオブジェクトは検索対象から除外
        if (objectAccessConditions.contains(false)) {
            throw new ObjectRecordSearchException('このレコード一覧を表示する権限がありません。管理者にアクセス権限を確認してください。');
        }
        // 検索画面の後続処理へ検証済み describe 結果を返却
        return objectDescribe;
    }

    /**
     * 対象オブジェクトの Name 相当項目の describe 結果を返却
     *
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return Name 相当項目の describe 結果
     * @throws ObjectRecordSearchException Name 相当項目を参照できない場合
     */
    public Schema.DescribeFieldResult getNameFieldDescribe(Schema.DescribeSObjectResult objectDescribe) {
        // オブジェクト describe 未指定時は項目走査前に拒否
        if (objectDescribe == null) {
            throw new ObjectRecordSearchException('検索に必要な項目を利用できません。管理者に項目設定を確認してください。');
        }
        // isNameField を優先して主表示項目を検出
        // 項目 API 名から項目 token を引ける Map を取得
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        // 主表示項目の走査対象を List として確定
        List<Schema.SObjectField> fieldTokens = fieldsByApiName.values();
        // isNameField が付いた項目を主表示項目として採用
        Schema.DescribeFieldResult nameFieldDescribe = findNameFieldDescribe(fieldTokens);
        // isNameField が取れない場合に使う標準 Name 項目を取得
        Schema.SObjectField fallbackNameField = fieldsByApiName.get('Name');
        if (nameFieldDescribe == null) {
            // 標準 Name 項目を主表示項目としてフォールバック
            nameFieldDescribe = fallbackNameField?.getDescribe();
        }
        if (nameFieldDescribe == null) {
            throw new ObjectRecordSearchException('検索に必要な項目を利用できません。管理者に項目設定を確認してください。');
        }
        // 主表示項目の参照権限がある場合だけ一覧表示を許可
        Boolean isNameFieldAccessible = nameFieldDescribe.isAccessible();
        if (!isNameFieldAccessible) {
            throw new ObjectRecordSearchException('検索に必要な項目を参照する権限がありません。管理者に項目権限を確認してください。');
        }
        // 検索と表示に利用できる Name 相当項目を返却
        return nameFieldDescribe;
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
    public ObjectRecordSearchQueryPlan.SearchQueryRequest createSearchQueryRequest(ObjectRecordSearchContext context, ObjectRecordSearchRequestWrapper request, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        // ページトークンを現在のソート条件に対応するカーソルへ復元
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        searchQueryRequest.context = context;
        searchQueryRequest.searchRequest = request;
        // 任意の名称フィルターを問い合わせ処理で共有する値へ正規化
        searchQueryRequest.normalizedSearchTerm = request?.searchTerm?.trim();
        searchQueryRequest.sortSpec = sortSpec;
        String pageToken = request?.pageToken;
        ObjectRecordSearchSortSupport.PageCursor cursor = ObjectRecordSearchSortSupport.parsePageToken(
            pageToken,
            sortSpec
        );
        searchQueryRequest.cursor = cursor;
        searchQueryRequest.fetchSize = PAGE_FETCH_SIZE;
        return searchQueryRequest;
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
