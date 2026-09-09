/**
 * 汎用レコード検索画面の一覧に表示する固定項目の Wrapper
 */
public with sharing class ObjectRecordSearchFieldWrapper {

    // 項目 API 参照名
    @AuraEnabled
    public String apiName { get; private set; }

    // 項目の画面表示ラベル
    @AuraEnabled
    public String label { get; private set; }

    // lightning-datatable で使う表示型
    @AuraEnabled
    public String dataType { get; private set; }

    // SOQLでこの項目をソートできるか
    @AuraEnabled
    public Boolean sortable { get; private set; }

    /**
     * 固定項目定義を作成
     *
     * @param apiName 項目 API 参照名
     * @param label 項目の画面表示ラベル
     * @param dataType lightning-datatable で使う表示型
     */
    public ObjectRecordSearchFieldWrapper(String apiName, String label, String dataType) {
        // datatable の列キーとして使えるようにする
        this.apiName = apiName ?? '';
        // datatable の列見出しへ表示する
        this.label = label ?? '';
        // datatable の表示形式を指定できるようにする
        this.dataType = dataType ?? '';
        // 未指定の場合はソート操作を許可しない
        this.sortable = false;
    }

    /**
     * Describeから表示項目とソート可否を作成
     *
     * @param fieldDescribe 表示項目のDescribe情報、nullの場合は空項目
     * @param dataType lightning-datatableで使う表示型
     */
    public ObjectRecordSearchFieldWrapper(Schema.DescribeFieldResult fieldDescribe, String dataType) {
        // 表示名とAPI名の正規化を共通の初期化へ委譲
        this(fieldDescribe?.getName(), fieldDescribe?.getLabel(), dataType);
        // Describeが許可するソート操作だけを画面へ公開
        this.sortable = fieldDescribe?.isSortable() == true;
    }

}