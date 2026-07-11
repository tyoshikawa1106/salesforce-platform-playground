/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口
 */
public with sharing class ObjectRecordSearchController {

    private static final String CONFIG_ERROR_MESSAGE = '検索画面を表示できませんでした。時間をおいてもう一度お試しください。';
    private static final String SEARCH_ERROR_MESSAGE = 'レコード一覧を表示できませんでした。検索条件を見直して、もう一度お試しください。';
    private static final String DELETE_ERROR_MESSAGE = '選択したレコードを削除できませんでした。権限やレコードの状態を確認してください。';

    private ObjectRecordSearchService service = new ObjectRecordSearchService();
    private ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

    /**
     * 表示キーに対応する検索画面設定を返す
     *
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchConfigWrapper getObjectConfig(String metricKey) {
        // 静的 Apex 入口から内部インスタンスへ処理を委譲
        ObjectRecordSearchController controller = new ObjectRecordSearchController();
        return controller.getObjectConfigForMetricKey(metricKey);
    }

    private ObjectRecordSearchConfigWrapper getObjectConfigForMetricKey(String metricKey) {
        try {
            // 表示キーから検索画面に必要な describe 情報を集約
            ObjectRecordSearchContext context = buildSearchContext(metricKey);
            return context.config;
        } catch (ObjectRecordSearchException e) {
            String errorMessage = e.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception e) {
            throw createHandledException(CONFIG_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索
     *
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchResultWrapper searchRecords(ObjectRecordSearchRequestWrapper request) {
        // 静的 Apex 入口から検索フローの組み立てへ処理を委譲
        ObjectRecordSearchController controller = new ObjectRecordSearchController();
        return controller.searchRecordsForRequest(request);
    }

    private ObjectRecordSearchResultWrapper searchRecordsForRequest(ObjectRecordSearchRequestWrapper request) {
        try {
            // リクエストの表示キーで検索対象オブジェクトを確定
            String metricKey = request?.metricKey;
            ObjectRecordSearchContext context = buildSearchContext(
                metricKey
            );
            // 許可済み項目だけで検索用ソート条件を作成
            ObjectRecordSearchSortSupport.SortSpec sortSpec = this.service.createSortSpec(
                context,
                request
            );
            // SOQL 作成と結果整形で共有する検索条件を作成
            ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = this.service.createSearchQueryRequest(
                context,
                request,
                sortSpec
            );
            // bind 値付き SOQL に変換して USER_MODE 実行へ渡す
            ObjectRecordSearchQueryPlan.SearchQuery searchQuery = ObjectRecordSearchQueryPlan.createSearchQuery(
                searchQueryRequest
            );
            List<SObject> records = this.selector.searchRecords(searchQuery);
            // 検索結果を LWC 返却用の行とページ状態へ変換
            ObjectRecordSearchResultWrapper result = this.service.createSearchResult(
                searchQueryRequest,
                records
            );
            return result;
        } catch (ObjectRecordSearchException e) {
            String errorMessage = e.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception e) {
            throw createHandledException(SEARCH_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコード削除
     *
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    @AuraEnabled
    public static ObjectRecordSearchDeleteWrapper deleteRecords(String metricKey, List<Id> recordIds) {
        // 静的 Apex 入口から削除フローの組み立てへ処理を委譲
        ObjectRecordSearchController controller = new ObjectRecordSearchController();
        return controller.deleteSelectedRecords(metricKey, recordIds);
    }

    private ObjectRecordSearchDeleteWrapper deleteSelectedRecords(String metricKey, List<Id> recordIds) {
        try {
            // 削除対象オブジェクトの権限と表示設定を確定
            ObjectRecordSearchContext context = buildSearchContext(
                metricKey
            );
            ObjectRecordSearchConfigWrapper config = context.config;
            // DML 不要なリクエストは空の削除結果へ短絡
            Boolean canDeleteRecords = this.service.canDeleteRecords(
                config,
                recordIds
            );
            if (!canDeleteRecords) {
                return this.service.createDeleteResult(recordIds, null);
            }
            // 指定 ID だけを USER_MODE で取得して削除対象を確定
            Set<Id> recordIdsToDelete = new Set<Id>(recordIds);
            List<SObject> recordsToDelete = this.selector.getRecordsById(
                config.objectApiName,
                recordIdsToDelete
            );
            // 部分成功を許容した DML 結果を画面向け結果へ変換
            List<Database.DeleteResult> deleteResults = this.selector.deleteRecords(
                recordsToDelete
            );
            ObjectRecordSearchDeleteWrapper result = this.service.createDeleteResult(
                recordIds,
                deleteResults
            );
            return result;
        } catch (ObjectRecordSearchException e) {
            String errorMessage = e.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception e) {
            throw createHandledException(DELETE_ERROR_MESSAGE);
        }
    }

    private ObjectRecordSearchContext buildSearchContext(String metricKey) {
        // 表示キーからカタログ定義を解決して対象オブジェクトを固定
        ObjectMetricCatalog.MetricDefinition definition = this.service.requireDefinition(
            metricKey
        );
        // オブジェクト参照権限とクエリ可能性を検証
        Schema.DescribeSObjectResult objectDescribe = this.selector.getObjectDescribe(
            definition.objectApiName
        );
        // 一覧の主表示項目として使う Name 相当項目を解決
        Schema.DescribeFieldResult nameFieldDescribe = this.selector.getNameFieldDescribe(
            objectDescribe
        );
        // 画面に返す固定表示項目を権限で絞り込み
        List<ObjectRecordSearchFieldWrapper> displayFields = ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
            definition.objectApiName,
            objectDescribe
        );
        // LWC 返却用設定と内部検索状態を同じ describe 情報で構築
        ObjectRecordSearchConfigWrapper config = this.service.createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        );
        config = config.withDisplayFields(displayFields);
        ObjectRecordSearchContext context = this.service.createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
        return context;
    }

    private static AuraHandledException createHandledException(String message) {
        return new AuraHandledException(message);
    }
}