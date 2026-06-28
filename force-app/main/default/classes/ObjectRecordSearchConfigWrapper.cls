/**
 * 汎用レコード検索画面の設定を LWC に返す Wrapper です。
 */
public with sharing class ObjectRecordSearchConfigWrapper {
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
    public List<ObjectRecordSearchFieldWrapper> displayFields {
        get;
        private set;
    }

    private Map<String, Schema.DescribeFieldResult> allowedFieldDescribesByApiName;

    /**
     * 検索画面設定を作成します。
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
        allowedFieldDescribesByApiName = new Map<String, Schema.DescribeFieldResult>{
            nameFieldApiName => nameFieldDescribe
        };
    }

    /**
     * 一覧に追加表示する固定項目を反映します。
     * ConfigWrapper は LWC 返却用の形に加えて、検索とソートで使える項目の describe を保持します。
     * これにより Service 配下の処理が同じオブジェクトを再 describe せずに済みます。
     *
     * @param displayFields 一覧に追加表示する固定項目
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return 固定項目を反映した検索画面設定
     */
    public ObjectRecordSearchConfigWrapper withDisplayFields(
        List<ObjectRecordSearchFieldWrapper> displayFields,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        this.displayFields = displayFields == null
            ? new List<ObjectRecordSearchFieldWrapper>()
            : displayFields;

        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        for (ObjectRecordSearchFieldWrapper displayField : this.displayFields) {
            if (!fieldsByApiName.containsKey(displayField.apiName)) {
                continue;
            }
            allowedFieldDescribesByApiName.put(
                displayField.apiName,
                fieldsByApiName.get(displayField.apiName).getDescribe()
            );
        }
        return this;
    }

    /**
     * 検索クエリで SELECT できる項目 API 参照名を返します。
     * @return Name 相当項目と追加表示項目の API 参照名
     */
    public List<String> getQueryFieldApiNames() {
        return new List<String>(getAllowedFieldApiNames());
    }

    /**
     * 画面からのソート指定を受け付ける項目 API 参照名を返します。
     * @return Name 相当項目と追加表示項目の API 参照名
     */
    public Set<String> getAllowedFieldApiNames() {
        return new Set<String>(allowedFieldDescribesByApiName.keySet());
    }

    /**
     * 検索やソートで利用できる項目の describe 結果を返します。
     * @param fieldApiName 項目 API 参照名
     * @return 許可済み項目の describe 結果。対象外の項目は null
     */
    public Schema.DescribeFieldResult getAllowedFieldDescribe(
        String fieldApiName
    ) {
        return allowedFieldDescribesByApiName.get(fieldApiName);
    }
}
