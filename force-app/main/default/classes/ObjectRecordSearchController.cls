/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口です。
 */
public with sharing class ObjectRecordSearchController {
    private static final Integer MAX_ROWS = 200;
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
     * @param metricKey データボードカードの表示キー
     * @param searchTerm Name 項目に対する検索語
     * @return 最大 200 件の検索結果
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchResult searchRecords(
        String metricKey,
        String searchTerm
    ) {
        try {
            return new ObjectRecordSearchService()
                .searchRecords(metricKey, searchTerm);
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
         * 検索画面設定を作成します。
         *
         * @param definition データボードカードと対象オブジェクトの定義
         * @param objectDescribe 対象オブジェクトの describe 結果
         * @param nameFieldDescribe Name 相当項目の describe 結果
         */
        public ObjectRecordSearchConfig(
            ObjectMetricCatalog.MetricDefinition definition,
            Schema.DescribeSObjectResult objectDescribe,
            Schema.DescribeFieldResult nameFieldDescribe
        ) {
            metricKey = definition.key;
            objectApiName = definition.objectApiName;
            objectLabel = definition.label;
            nameFieldApiName = nameFieldDescribe.getName();
            nameFieldLabel = nameFieldDescribe.getLabel();
            deletable = objectDescribe.isDeletable();
            createable = objectDescribe.isCreateable();
            updateable = objectDescribe.isUpdateable();
            searchable =
                nameFieldDescribe.isAccessible() &&
                nameFieldDescribe.isFilterable();
            nameFieldCreateable = nameFieldDescribe.isCreateable();
            nameFieldUpdateable = nameFieldDescribe.isUpdateable();
        }
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
         * Apex 側の最大取得件数です。
         */
        @AuraEnabled
        public Integer limitSize { get; private set; }

        /**
         * レコード検索結果を作成します。
         *
         * @param config 検索画面設定
         * @param records 一覧に表示するレコード行
         * @param limitSize Apex 側の最大取得件数
         */
        public ObjectRecordSearchResult(
            ObjectRecordSearchConfig config,
            List<ObjectRecordRow> records,
            Integer limitSize
        ) {
            this.config = config;
            this.records = records;
            this.limitSize = limitSize;
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
         * レコード作成日時です。
         */
        @AuraEnabled
        public Datetime createdDate { get; private set; }

        /**
         * レコード最終更新日時です。
         */
        @AuraEnabled
        public Datetime lastModifiedDate { get; private set; }

        /**
         * 検索結果 SObject から一覧行を作成します。
         *
         * @param record 検索結果 SObject
         * @param objectApiName 対象オブジェクト API 参照名
         * @param nameFieldApiName Name 相当項目 API 参照名
         */
        public ObjectRecordRow(
            SObject record,
            String objectApiName,
            String nameFieldApiName
        ) {
            id = (Id) record.get('Id');
            Object rawName = record.get(nameFieldApiName);
            name = rawName == null
                ? String.valueOf(id)
                : String.valueOf(rawName);
            recordUrl =
                '/lightning/r/' +
                objectApiName +
                '/' +
                String.valueOf(id) +
                '/view';
            createdDate = (Datetime) record.get('CreatedDate');
            lastModifiedDate = (Datetime) record.get('LastModifiedDate');
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