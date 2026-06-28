/**
 * 汎用レコード検索画面の設定に使う参照権限と固定項目の Wrapper です。
 */
public with sharing class ObjectRecordSearchAccessWrapper {
    /** 対象オブジェクトでレコード削除が許可されているかどうか。 */
    public Boolean deletable { get; private set; }

    /** 対象オブジェクトでレコード作成が許可されているかどうか。 */
    public Boolean createable { get; private set; }

    /** 対象オブジェクトでレコード更新が許可されているかどうか。 */
    public Boolean updateable { get; private set; }

    /** 一覧に追加表示する固定項目。 */
    public List<ObjectRecordSearchFieldWrapper> displayFields {
        get;
        private set;
    }

    /**
     * 検索画面設定向けの参照権限と固定項目を作成します。
     *
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @param displayFields 一覧に追加表示する固定項目
     */
    public ObjectRecordSearchAccessWrapper(
        Schema.DescribeSObjectResult objectDescribe,
        List<ObjectRecordSearchFieldWrapper> displayFields
    ) {
        deletable = objectDescribe.isDeletable();
        createable = objectDescribe.isCreateable();
        updateable = objectDescribe.isUpdateable();
        this.displayFields = displayFields;
    }
}
