/**
 * 汎用レコード検索画面の設定を LWC に返す Wrapper
 */
public with sharing class ObjectRecordSearchConfigWrapper {
    /**
     * データボードカードの表示キー
     */
    @AuraEnabled
    public String metricKey { get; private set; }

    /**
     * 対象オブジェクト API 参照名
     */
    @AuraEnabled
    public String objectApiName { get; private set; }

    /**
     * 対象オブジェクトの画面表示ラベル
     */
    @AuraEnabled
    public String objectLabel { get; private set; }

    /**
     * Name 相当項目の API 参照名
     */
    @AuraEnabled
    public String nameFieldApiName { get; private set; }

    /**
     * Name 相当項目の画面表示ラベル
     */
    @AuraEnabled
    public String nameFieldLabel { get; private set; }

    /**
     * 現在ユーザーが対象オブジェクトを削除できるかどうか
     */
    @AuraEnabled
    public Boolean deletable { get; private set; }

    /**
     * 現在ユーザーが対象オブジェクトを作成できるかどうか
     */
    @AuraEnabled
    public Boolean createable { get; private set; }

    /**
     * 現在ユーザーが対象オブジェクトを更新できるかどうか
     */
    @AuraEnabled
    public Boolean updateable { get; private set; }

    /**
     * Name 相当項目で検索できるかどうか
     */
    @AuraEnabled
    public Boolean searchable { get; private set; }

    /**
     * Name 相当項目を作成時に設定できるかどうか
     */
    @AuraEnabled
    public Boolean nameFieldCreateable { get; private set; }

    /**
     * Name 相当項目を更新できるかどうか
     */
    @AuraEnabled
    public Boolean nameFieldUpdateable { get; private set; }

    /**
     * 一覧に追加表示する固定項目
     */
    @AuraEnabled
    public List<ObjectRecordSearchFieldWrapper> displayFields {
        get;
        private set;
    }

    /**
     * 検索画面設定を作成
     *
     * @param definition データボードカードと対象オブジェクトの定義
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     */
    public ObjectRecordSearchConfigWrapper(
        ObjectMetricCatalog.MetricDefinition definition,
        Schema.DescribeFieldResult nameFieldDescribe,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        // describe 結果から LWC が必要な表示名と権限フラグを固定
        metricKey = definition.key;
        objectApiName = definition.objectApiName;
        objectLabel = definition.label;
        nameFieldApiName = nameFieldDescribe.getName();
        nameFieldLabel = nameFieldDescribe.getLabel();
        deletable = objectDescribe.isDeletable();
        createable = objectDescribe.isCreateable();
        updateable = objectDescribe.isUpdateable();
        searchable =
            nameFieldDescribe.isAccessible() && nameFieldDescribe.isFilterable();
        nameFieldCreateable = nameFieldDescribe.isCreateable();
        nameFieldUpdateable = nameFieldDescribe.isUpdateable();
        displayFields = new List<ObjectRecordSearchFieldWrapper>();
    }

    /**
     * 一覧に追加表示する固定項目反映
     *
     * @param displayFields 一覧に追加表示する固定項目
     * @return 固定項目を反映した検索画面設定
     */
    public ObjectRecordSearchConfigWrapper withDisplayFields(
        List<ObjectRecordSearchFieldWrapper> displayFields
    ) {
        // null 入力でも LWC へ空リストを返す
        this.displayFields = displayFields == null
            ? new List<ObjectRecordSearchFieldWrapper>()
            : displayFields;
        return this;
    }
}
