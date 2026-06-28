/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口です。
 */
public with sharing class ObjectRecordSearchController {
    private static final String USER_FACING_ERROR_MESSAGE = 'レコード一覧を読み込めませんでした。';

    /**
     * 表示キーに対応する検索画面設定を返します。
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchConfig getObjectConfig(String metricKey) {
        try {
            return new ObjectRecordSearchService().getObjectConfig(metricKey);
        } catch (Exception error) {
            throw new AuraHandledException(USER_FACING_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索します。
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchResult searchRecords(
        ObjectRecordSearchRequest request
    ) {
        try {
            return new ObjectRecordSearchService().searchRecords(request);
        } catch (Exception error) {
            throw new AuraHandledException(USER_FACING_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコードを削除します。
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    @AuraEnabled
    public static ObjectRecordDeleteResult deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        try {
            return new ObjectRecordSearchService()
                .deleteRecords(metricKey, recordIds);
        } catch (Exception error) {
            throw new AuraHandledException(
                '選択したレコードを削除できませんでした。'
            );
        }
    }

    /**
     * レコード検索画面の設定 DTO です。
     */
    public class ObjectRecordSearchConfig {
        /**
         * データボードカードの表示キーです。
         */
        @AuraEnabled
        public String metricKey { get; private set; }

        /**
         * 対象オブジェクト API 参照名です。
         */
        @AuraEnabled
        public String objectApiName { get; private set; }

        /**
         * 対象オブジェクトの画面表示ラベルです。
         */
        @AuraEnabled
        public String objectLabel { get; private set; }

        /**
         * Name 相当項目の API 参照名です。
         */
        @AuraEnabled
        public String nameFieldApiName { get; private set; }

        /**
         * Name 相当項目の画面表示ラベルです。
         */
        @AuraEnabled
        public String nameFieldLabel { get; private set; }

        /**
         * 現在ユーザーが対象オブジェクトを削除できるかどうかです。
         */
        @AuraEnabled
        public Boolean deletable { get; private set; }

        /**
         * 現在ユーザーが対象オブジェクトを作成できるかどうかです。
         */
        @AuraEnabled
        public Boolean createable { get; private set; }

        /**
         * 現在ユーザーが対象オブジェクトを更新できるかどうかです。
         */
        @AuraEnabled
        public Boolean updateable { get; private set; }

        /**
         * Name 相当項目で検索できるかどうかです。
         */
        @AuraEnabled
        public Boolean searchable { get; private set; }

        /**
         * Name 相当項目を作成時に設定できるかどうかです。
         */
        @AuraEnabled
        public Boolean nameFieldCreateable { get; private set; }

        /**
         * Name 相当項目を更新できるかどうかです。
         */
        @AuraEnabled
        public Boolean nameFieldUpdateable { get; private set; }

        /**
         * 一覧に追加表示する固定項目です。
         */
        @AuraEnabled
        public List<ObjectRecordDisplayField> displayFields { get; private set; }

        /**
         * 検索画面設定を作成します。
         *
         * @param definition データボードカードと対象オブジェクトの定義
         * @param nameFieldDescribe Name 相当項目の describe 結果
         * @param access 対象オブジェクトの参照権限と固定項目
         */
        public ObjectRecordSearchConfig(
            ObjectMetricCatalog.MetricDefinition definition,
            Schema.DescribeFieldResult nameFieldDescribe,
            ObjectRecordSearchAccess access
        ) {
            metricKey = definition.key;
            objectApiName = definition.objectApiName;
            objectLabel = definition.label;
            nameFieldApiName = nameFieldDescribe.getName();
            nameFieldLabel = nameFieldDescribe.getLabel();
            deletable = access.deletable;
            createable = access.createable;
            updateable = access.updateable;
            searchable =
                nameFieldDescribe.isAccessible() &&
                nameFieldDescribe.isFilterable();
            nameFieldCreateable = nameFieldDescribe.isCreateable();
            nameFieldUpdateable = nameFieldDescribe.isUpdateable();
            displayFields = access.displayFields == null
                ? new List<ObjectRecordDisplayField>()
                : access.displayFields;
        }
    }

    /**
     * 検索画面設定に使う参照権限と固定項目です。
     */
    public class ObjectRecordSearchAccess {
        /** 対象オブジェクトでレコード削除が許可されているかどうか。 */
        public Boolean deletable { get; private set; }

        /** 対象オブジェクトでレコード作成が許可されているかどうか。 */
        public Boolean createable { get; private set; }

        /** 対象オブジェクトでレコード更新が許可されているかどうか。 */
        public Boolean updateable { get; private set; }

        /** 一覧に追加表示する固定項目。 */
        public List<ObjectRecordDisplayField> displayFields { get; private set; }

        /**
         * 検索画面設定向けの参照権限と固定項目を作成します。
         *
         * @param objectDescribe 対象オブジェクトの describe 結果
         * @param displayFields 一覧に追加表示する固定項目
         */
        public ObjectRecordSearchAccess(
            Schema.DescribeSObjectResult objectDescribe,
            List<ObjectRecordDisplayField> displayFields
        ) {
            deletable = objectDescribe.isDeletable();
            createable = objectDescribe.isCreateable();
            updateable = objectDescribe.isUpdateable();
            this.displayFields = displayFields;
        }
    }

    /**
     * 一覧に表示する固定項目の定義です。
     */
    public class ObjectRecordDisplayField {
        /**
         * 項目 API 参照名です。
         */
        @AuraEnabled
        public String apiName { get; private set; }

        /**
         * 項目の画面表示ラベルです。
         */
        @AuraEnabled
        public String label { get; private set; }

        /**
         * lightning-datatable で使う表示型です。
         */
        @AuraEnabled
        public String dataType { get; private set; }

        /**
         * 固定項目定義を作成します。
         *
         * @param apiName 項目 API 参照名
         * @param label 項目の画面表示ラベル
         * @param dataType lightning-datatable で使う表示型
         */
        public ObjectRecordDisplayField(
            String apiName,
            String label,
            String dataType
        ) {
            this.apiName = apiName;
            this.label = label;
            this.dataType = dataType;
        }
    }

    /**
     * レコード検索リクエスト DTO です。
     */
    public class ObjectRecordSearchRequest {
        /**
         * データボードカードの表示キーです。
         */
        @AuraEnabled
        public String metricKey { get; set; }

        /**
         * Name 項目に対する検索語です。
         */
        @AuraEnabled
        public String searchTerm { get; set; }

        /**
         * 次ページ取得用のカーソルトークンです。
         */
        @AuraEnabled
        public String pageToken { get; set; }

        /**
         * 一覧のソート項目です。
         */
        @AuraEnabled
        public String sortBy { get; set; }

        /**
         * 一覧のソート方向です。
         */
        @AuraEnabled
        public String sortDirection { get; set; }

        /**
         * 画面表示用のページ番号です。
         */
        @AuraEnabled
        public Integer pageNumber { get; set; }
    }

    /**
     * レコード検索ページ状態 DTO です。
     */
    public class ObjectRecordSearchPageState {
        /**
         * 1 ページあたりの最大表示件数です。
         */
        public Integer pageSize { get; set; }

        /**
         * 現在のページ番号です。
         */
        public Integer pageNumber { get; set; }

        /**
         * 次ページ取得用のカーソルトークンです。
         */
        public String nextPageToken { get; set; }
    }

    /**
     * レコード検索結果 DTO です。
     */
    public class ObjectRecordSearchResult {
        /**
         * 検索画面設定です。
         */
        @AuraEnabled
        public ObjectRecordSearchConfig config { get; private set; }

        /**
         * 一覧に表示するレコード行です。
         */
        @AuraEnabled
        public List<ObjectRecordRow> records { get; private set; }

        /**
         * 1 ページあたりの最大表示件数です。
         */
        @AuraEnabled
        public Integer pageSize { get; private set; }

        /**
         * 現在のページ番号です。
         */
        @AuraEnabled
        public Integer pageNumber { get; private set; }

        /**
         * 次ページがあるかどうかです。
         */
        @AuraEnabled
        public Boolean hasNextPage { get; private set; }

        /**
         * 次ページ取得用のカーソルトークンです。
         */
        @AuraEnabled
        public String nextPageToken { get; private set; }

        /**
         * レコード検索結果を作成します。
         *
         * @param config 検索画面設定
         * @param records 一覧に表示するレコード行
         * @param pageState ページ状態
         */
        public ObjectRecordSearchResult(
            ObjectRecordSearchConfig config,
            List<ObjectRecordRow> records,
            ObjectRecordSearchPageState pageState
        ) {
            this.config = config;
            this.records = records;
            pageSize = pageState.pageSize;
            pageNumber = pageState.pageNumber;
            nextPageToken = pageState.nextPageToken;
            hasNextPage = String.isNotBlank(nextPageToken);
        }
    }

    /**
     * 一覧行 DTO です。
     */
    public class ObjectRecordRow {
        /**
         * レコード ID です。
         */
        @AuraEnabled
        public Id id { get; private set; }

        /**
         * Name 相当項目の表示値です。
         */
        @AuraEnabled
        public String name { get; private set; }

        /**
         * Salesforce 標準詳細ページの相対 URL です。
         */
        @AuraEnabled
        public String recordUrl { get; private set; }

        /**
         * 固定表示項目の値です。
         */
        @AuraEnabled
        public Map<String, String> fieldValues { get; private set; }

        /**
         * 検索結果 SObject から一覧行を作成します。
         *
         * @param record 検索結果 SObject
         * @param nameFieldApiName Name 相当項目 API 参照名
         * @param displayFields 一覧に追加表示する固定項目
         */
        public ObjectRecordRow(
            SObject record,
            String nameFieldApiName,
            List<ObjectRecordDisplayField> displayFields
        ) {
            id = (Id) record.get('Id');
            Object rawName = record.get(nameFieldApiName);
            name = rawName == null
                ? String.valueOf(id)
                : String.valueOf(rawName);
            recordUrl =
                '/lightning/r/' +
                record.getSObjectType().getDescribe().getName() +
                '/' +
                String.valueOf(id) +
                '/view';
            fieldValues = createFieldValues(record, displayFields);
        }

        private Map<String, String> createFieldValues(
            SObject record,
            List<ObjectRecordDisplayField> displayFields
        ) {
            Map<String, String> valuesByField = new Map<String, String>();
            for (ObjectRecordDisplayField displayField : displayFields) {
                valuesByField.put(
                    displayField.apiName,
                    formatValue(record.get(displayField.apiName))
                );
            }
            return valuesByField;
        }

        private String formatValue(Object value) {
            if (value == null) {
                return '';
            }
            return String.valueOf(value);
        }
    }

    /**
     * 削除結果 DTO です。
     */
    public class ObjectRecordDeleteResult {
        /**
         * LWC から削除要求された ID 件数です。
         */
        @AuraEnabled
        public Integer requestedCount { get; private set; }

        /**
         * 削除に成功した件数です。
         */
        @AuraEnabled
        public Integer deletedCount { get; private set; }

        /**
         * 削除に失敗した場合のユーザー表示向けメッセージです。
         */
        @AuraEnabled
        public List<String> errors { get; private set; }

        /**
         * 削除結果を作成します。
         *
         * @param requestedCount LWC から削除要求された ID 件数
         * @param deletedCount 削除に成功した件数
         * @param errors 削除に失敗した場合のユーザー表示向けメッセージ
         */
        public ObjectRecordDeleteResult(
            Integer requestedCount,
            Integer deletedCount,
            List<String> errors
        ) {
            this.requestedCount = requestedCount;
            this.deletedCount = deletedCount;
            this.errors = errors;
        }
    }
}
