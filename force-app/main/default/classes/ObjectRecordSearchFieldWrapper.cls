/**
 * 汎用レコード検索画面の一覧に表示する固定項目の Wrapper です。
 */
public with sharing class ObjectRecordSearchFieldWrapper {
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
     * @param apiName 項目 API 参照名。
     * @param label 項目の画面表示ラベル。
     * @param dataType lightning-datatable で使う表示型。
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
