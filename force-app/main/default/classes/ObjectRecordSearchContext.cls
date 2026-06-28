/**
 * 汎用レコード検索の Apex 内部処理で共有する状態です。
 */
public with sharing class ObjectRecordSearchContext {
    /**
     * LWC に返す検索画面設定です。
     */
    public ObjectRecordSearchConfigWrapper config { get; private set; }

    private Map<String, Schema.DescribeFieldResult> allowedFieldDescribesByApiName;

    /**
     * 検索画面の内部処理状態を作成します。
     *
     * @param config LWC に返す検索画面設定
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     */
    public ObjectRecordSearchContext(
        ObjectRecordSearchConfigWrapper config,
        Schema.DescribeFieldResult nameFieldDescribe,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        this.config = config;
        allowedFieldDescribesByApiName = new Map<String, Schema.DescribeFieldResult>{
            config.nameFieldApiName => nameFieldDescribe
        };
        addDisplayFieldDescribes(config.displayFields, objectDescribe);
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

    private void addDisplayFieldDescribes(
        List<ObjectRecordSearchFieldWrapper> displayFields,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        for (ObjectRecordSearchFieldWrapper displayField : displayFields) {
            if (!fieldsByApiName.containsKey(displayField.apiName)) {
                continue;
            }
            allowedFieldDescribesByApiName.put(
                displayField.apiName,
                fieldsByApiName.get(displayField.apiName).getDescribe()
            );
        }
    }
}
