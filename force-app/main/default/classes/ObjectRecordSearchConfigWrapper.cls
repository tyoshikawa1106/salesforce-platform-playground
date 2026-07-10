/**
 * 汎用レコード検索画面の設定を LWC に返す Wrapper
 */
public with sharing class ObjectRecordSearchConfigWrapper {

    // データボードカードの表示キー
    @AuraEnabled
    public String metricKey { get; private set; }

    // 対象オブジェクト API 参照名
    @AuraEnabled
    public String objectApiName { get; private set; }

    // 対象オブジェクトの画面表示ラベル
    @AuraEnabled
    public String objectLabel { get; private set; }

    // Name 相当項目の API 参照名
    @AuraEnabled
    public String nameFieldApiName { get; private set; }

    // Name 相当項目の画面表示ラベル
    @AuraEnabled
    public String nameFieldLabel { get; private set; }

    // 現在ユーザーが対象オブジェクトを削除できるかどうか
    @AuraEnabled
    public Boolean deletable { get; private set; }

    // 現在ユーザーが対象オブジェクトを作成できるかどうか
    @AuraEnabled
    public Boolean createable { get; private set; }

    // 現在ユーザーが対象オブジェクトを更新できるかどうか
    @AuraEnabled
    public Boolean updateable { get; private set; }

    // Name 相当項目で検索できるかどうか
    @AuraEnabled
    public Boolean searchable { get; private set; }

    // Name 相当項目を作成時に設定できるかどうか
    @AuraEnabled
    public Boolean nameFieldCreateable { get; private set; }

    // Name 相当項目を更新できるかどうか
    @AuraEnabled
    public Boolean nameFieldUpdateable { get; private set; }

    // 一覧に追加表示する固定項目
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
    public ObjectRecordSearchConfigWrapper(ObjectMetricCatalog.MetricDefinition definition, Schema.DescribeFieldResult nameFieldDescribe, Schema.DescribeSObjectResult objectDescribe) {
        // データボードカードと検索画面設定を対応させる
        this.metricKey = definition.key;
        // 検索対象オブジェクトを LWC 側で参照できるようにする
        this.objectApiName = definition.objectApiName;
        // 画面見出しへ表示する対象オブジェクト名を返す
        this.objectLabel = definition.label;
        // 検索条件に使う Name 相当項目を固定
        this.nameFieldApiName = nameFieldDescribe.getName();
        // 検索入力ラベルへ表示する項目名を返す
        this.nameFieldLabel = nameFieldDescribe.getLabel();
        // 削除ボタンの表示可否を判断できるようにする
        this.deletable = objectDescribe.isDeletable();
        // 新規作成導線の表示可否を判断できるようにする
        this.createable = objectDescribe.isCreateable();
        // 編集導線の表示可否を判断できるようにする
        this.updateable = objectDescribe.isUpdateable();
        // 名称検索を使える場合だけ検索条件へ採用できるようにする
        this.searchable = nameFieldDescribe.isAccessible() && nameFieldDescribe.isFilterable();
        // 新規作成時に Name 相当項目を入力できるか返す
        this.nameFieldCreateable = nameFieldDescribe.isCreateable();
        // 更新時に Name 相当項目を変更できるか返す
        this.nameFieldUpdateable = nameFieldDescribe.isUpdateable();
        // 固定表示項目を後続処理で追加できるようにする
        this.displayFields = new List<ObjectRecordSearchFieldWrapper>();
    }

    /**
     * 一覧に追加表示する固定項目反映
     *
     * @param displayFields 一覧に追加表示する固定項目
     * @return 固定項目を反映した検索画面設定
     */
    public ObjectRecordSearchConfigWrapper withDisplayFields(List<ObjectRecordSearchFieldWrapper> displayFields) {
        // null 入力でも LWC へ空リストを返す
        this.displayFields = displayFields == null ? new List<ObjectRecordSearchFieldWrapper>() : displayFields;
        return this;
    }
}
