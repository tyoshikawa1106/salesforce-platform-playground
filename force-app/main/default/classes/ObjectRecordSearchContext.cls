/**
 * 汎用レコード検索の Apex 内部処理で共有する状態
 */
public with sharing class ObjectRecordSearchContext {

    /**
     * LWC に返す検索画面設定
     */
    public ObjectRecordSearchConfigWrapper config { get; private set; }

    private Map<String, Schema.DescribeFieldResult> allowedFieldDescribesByApiName;

    /**
     * 検索画面の内部処理状態を作成
     *
     * @param config LWC に返す検索画面設定
     * @param nameFieldDescribe Name 相当項目の describe 結果
     * @param objectDescribe 対象オブジェクトの describe 結果
     */
    public ObjectRecordSearchContext(ObjectRecordSearchConfigWrapper config, Schema.DescribeFieldResult nameFieldDescribe, Schema.DescribeSObjectResult objectDescribe) {
        this.config = config;
        // Name 相当項目は検索・表示・ソートで常に許可
        allowedFieldDescribesByApiName = new Map<String, Schema.DescribeFieldResult>{
            config.nameFieldApiName => nameFieldDescribe
        };
        // 固定表示項目も検索 SELECT とソート許可項目に加える
        addDisplayFieldDescribes(config.displayFields, objectDescribe);
    }

    /**
     * 検索クエリで SELECT できる項目 API 参照名を返す
     * @return Name 相当項目と追加表示項目の API 参照名
     */
    public List<String> getQueryFieldApiNames() {
        // 動的 SOQL の SELECT 対象を許可済み項目だけに限定
        Set<String> allowedFieldApiNames = getAllowedFieldApiNames();
        return new List<String>(allowedFieldApiNames);
    }

    /**
     * 画面からのソート指定を受け付ける項目 API 参照名を返す
     *
     * @return Name 相当項目と追加表示項目の API 参照名
     */
    public Set<String> getAllowedFieldApiNames() {
        // 呼び出し元が内部 Map を変更できないようコピーを返す
        Set<String> allowedFieldApiNames = allowedFieldDescribesByApiName.keySet();
        return new Set<String>(allowedFieldApiNames);
    }

    /**
     * 検索やソートで利用できる項目の describe 結果を返す
     * @param fieldApiName 項目 API 参照名
     * @return 許可済み項目の describe 結果、対象外の項目は null
     */
    public Schema.DescribeFieldResult getAllowedFieldDescribe(String fieldApiName) {
        return allowedFieldDescribesByApiName.get(fieldApiName);
    }

    private void addDisplayFieldDescribes(List<ObjectRecordSearchFieldWrapper> displayFields, Schema.DescribeSObjectResult objectDescribe) {
        // 表示設定に残った項目だけを検索・ソート許可 Map に追加
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        for (ObjectRecordSearchFieldWrapper displayField : displayFields) {
            Boolean hasDisplayField = fieldsByApiName.containsKey(
                displayField.apiName
            );
            if (!hasDisplayField) {
                continue;
            }
            Schema.SObjectField fieldToken = fieldsByApiName.get(
                displayField.apiName
            );
            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            allowedFieldDescribesByApiName.put(
                displayField.apiName,
                fieldDescribe
            );
        }
    }
}