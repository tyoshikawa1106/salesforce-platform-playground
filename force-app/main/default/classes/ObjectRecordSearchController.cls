/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口
 */
public with sharing class ObjectRecordSearchController {

    // 画面設定取得で想定外の処理失敗が発生した場合の案内
    private static final String CONFIG_ERROR_MESSAGE = '検索画面を表示できませんでした。時間をおいてもう一度お試しください。';
    // 検索で想定外の処理失敗が発生した場合の案内
    private static final String SEARCH_ERROR_MESSAGE = 'レコード一覧を表示できませんでした。検索条件を見直して、もう一度お試しください。';
    // 削除で想定外の処理失敗が発生した場合の案内
    private static final String DELETE_ERROR_MESSAGE = '選択したレコードを削除できませんでした。権限やレコードの状態を確認してください。';
    // データボードカードが検索対象として定義されていない場合の案内
    private static final String UNSUPPORTED_METRIC_MESSAGE = 'このカードのレコード一覧は表示できません。別のカードを選択してください。';
    // 固定カタログの対象オブジェクトが組織に存在しない場合の案内
    private static final String OBJECT_UNAVAILABLE_MESSAGE = 'このカードの対象オブジェクトを利用できません。別のカードを選択してください。';
    // 利用者が対象オブジェクトを検索できない場合の案内
    private static final String OBJECT_ACCESS_DENIED_MESSAGE = 'このレコード一覧を表示する権限がありません。管理者にアクセス権限を確認してください。';
    // 一覧の主表示に使う項目が組織に存在しない場合の案内
    private static final String NAME_FIELD_UNAVAILABLE_MESSAGE = '検索に必要な項目を利用できません。管理者に項目設定を確認してください。';
    // 利用者が一覧の主表示項目を参照できない場合の案内
    private static final String NAME_FIELD_ACCESS_DENIED_MESSAGE = '検索に必要な項目を参照する権限がありません。管理者に項目権限を確認してください。';
    // 現在の検索条件でページ情報を再利用できない場合の案内
    private static final String INVALID_PAGE_TOKEN_MESSAGE = 'ページ情報を読み込めませんでした。一覧を更新してからもう一度お試しください。';
    // 下位層の判定結果を利用者が次の操作を選べる案内へ変換
    private static final Map<ObjectRecordSearchService.ErrorCode, String> ERROR_MESSAGES_BY_CODE = new Map<ObjectRecordSearchService.ErrorCode, String>{
        ObjectRecordSearchService.ErrorCode.UNSUPPORTED_METRIC_KEY => UNSUPPORTED_METRIC_MESSAGE,
        ObjectRecordSearchService.ErrorCode.OBJECT_UNAVAILABLE => OBJECT_UNAVAILABLE_MESSAGE,
        ObjectRecordSearchService.ErrorCode.OBJECT_ACCESS_DENIED => OBJECT_ACCESS_DENIED_MESSAGE,
        ObjectRecordSearchService.ErrorCode.NAME_FIELD_UNAVAILABLE => NAME_FIELD_UNAVAILABLE_MESSAGE,
        ObjectRecordSearchService.ErrorCode.NAME_FIELD_ACCESS_DENIED => NAME_FIELD_ACCESS_DENIED_MESSAGE,
        ObjectRecordSearchService.ErrorCode.INVALID_PAGE_TOKEN => INVALID_PAGE_TOKEN_MESSAGE
    };

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
            // 表示キーと権限に応じた検索画面の準備結果を取得
            ObjectRecordSearchService.SearchContextResult contextResult = this.service.resolveSearchContext(
                metricKey
            );
            if (!contextResult.isSuccess()) {
                String errorMessage = getErrorMessage(
                    contextResult.errorCode,
                    CONFIG_ERROR_MESSAGE
                );
                throw createHandledException(errorMessage);
            }
            return contextResult.context.config;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw createHandledException(CONFIG_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索
     *
     * 読み取り専用であり、レコード変更後は LWC から refreshApex による再取得が必要
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
            ObjectRecordSearchService.SearchContextResult contextResult = this.service.resolveSearchContext(
                metricKey
            );
            if (!contextResult.isSuccess()) {
                String errorMessage = getErrorMessage(
                    contextResult.errorCode,
                    SEARCH_ERROR_MESSAGE
                );
                throw createHandledException(errorMessage);
            }
            ObjectRecordSearchContext context = contextResult.context;
            // 許可済み項目だけで検索用ソート条件を作成
            ObjectRecordSearchSortSupport.SortSpec sortSpec = this.service.createSortSpec(
                context,
                request
            );
            // Selector の検索と Service の結果整形で共有する検索条件を作成
            ObjectRecordSearchService.SearchQueryRequestResult requestResult = this.service.createSearchQueryRequest(
                context,
                request,
                sortSpec
            );
            if (!requestResult.isSuccess()) {
                String errorMessage = getErrorMessage(
                    requestResult.errorCode,
                    SEARCH_ERROR_MESSAGE
                );
                throw createHandledException(errorMessage);
            }
            ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = requestResult.searchQueryRequest;
            // Selector 内で動的 SOQL と bind 値を組み立てて利用者権限で実行
            List<SObject> records = this.selector.searchRecords(searchQueryRequest);
            // 検索結果を LWC 返却用の行とページ状態へ変換
            ObjectRecordSearchResultWrapper result = this.service.createSearchResult(
                searchQueryRequest,
                records
            );
            return result;
        } catch (AuraHandledException e) {
            throw e;
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
            ObjectRecordSearchService.SearchContextResult contextResult = this.service.resolveSearchContext(
                metricKey
            );
            if (!contextResult.isSuccess()) {
                String errorMessage = getErrorMessage(
                    contextResult.errorCode,
                    DELETE_ERROR_MESSAGE
                );
                throw createHandledException(errorMessage);
            }
            ObjectRecordSearchContext context = contextResult.context;
            ObjectRecordSearchConfigWrapper config = context.config;
            Boolean canDeleteRecords = this.service.canDeleteRecords(
                config,
                recordIds
            );
            // 削除対象がない場合も要求件数を画面へ返せる結果にする
            if (!canDeleteRecords) {
                ObjectRecordSearchDeleteWrapper emptyResult = this.service.createDeleteResult(
                    recordIds,
                    new List<Database.DeleteResult>()
                );
                return emptyResult;
            }
            // 削除要求された ID を重複のない検索条件へ変換
            Set<Id> recordIdsToDelete = new Set<Id>(recordIds);
            // Selector 内で ID 条件の動的 SOQL と bind 値を組み立てて実行
            List<SObject> recordsToDelete = this.selector.getRecordsById(
                config.objectApiName,
                recordIdsToDelete
            );
            // 部分成功を許容した DML 結果を画面向け結果へ変換
            List<Database.DeleteResult> deleteResults = this.service.deleteRecords(
                recordsToDelete
            );
            ObjectRecordSearchDeleteWrapper result = this.service.createDeleteResult(
                recordIds,
                deleteResults
            );
            return result;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw createHandledException(DELETE_ERROR_MESSAGE);
        }
    }

    private static String getErrorMessage(ObjectRecordSearchService.ErrorCode errorCode, String fallbackMessage) {
        // 定義済みの失敗理由だけを利用者向け案内へ変換
        String errorMessage = ERROR_MESSAGES_BY_CODE.get(errorCode);
        return errorMessage ?? fallbackMessage;
    }

    private static AuraHandledException createHandledException(String message) {
        // ApexテストとLWC応答で同じ安全な案内を参照可能にする
        AuraHandledException handledException = new AuraHandledException(message);
        handledException.setMessage(message);
        return handledException;
    }
}
