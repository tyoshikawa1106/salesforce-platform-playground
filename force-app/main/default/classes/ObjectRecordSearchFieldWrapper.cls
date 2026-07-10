/**
 * 汎用レコード検索画面の一覧に表示する固定項目の Wrapper
 */
public with sharing class ObjectRecordSearchFieldWrapper {
    /**
     * 項目 API 参照名
     */
    @AuraEnabled
    public String apiName { get; private set; }

    /**
     * 項目の画面表示ラベル
     */
    @AuraEnabled
    public String label { get; private set; }

    /**
     * lightning-datatable で使う表示型
     */
    @AuraEnabled
    public String dataType { get; private set; }

    /**
     * 固定項目定義を作成
     *
     * @param apiName 項目 API 参照名
     * @param label 項目の画面表示ラベル
     * @param dataType lightning-datatable で使う表示型
     */
    public ObjectRecordSearchFieldWrapper(
        String apiName,
        String label,
        String dataType
    ) {
        this.apiName = apiName;
        this.label = label;
        this.dataType = dataType;
    }
}
