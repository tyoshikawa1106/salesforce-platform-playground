/**
 * 汎用レコード検索画面で使う Salesforce レコード問い合わせ
 */
public virtual with sharing class ObjectRecordSearchSelector {

    /**
     * 作成済みの検索クエリ計画でレコード取得
     *
     * @param searchQuery 実行する SOQL と bind 値
     * @return 検索結果 SObject
     */
    public virtual List<SObject> searchRecords(ObjectRecordSearchQueryPlan.SearchQuery searchQuery) {
        // 画面利用者の権限で bind 付き動的 SOQL を評価
        return Database.queryWithBinds(
            searchQuery.soql,
            searchQuery.bindValues,
            AccessLevel.USER_MODE
        );
    }

    /**
     * 対象オブジェクトから ID 指定で削除対象レコード取得
     *
     * @param objectApiName 対象オブジェクト API 参照名
     * @param recordIds 取得するレコード ID
     * @return 削除対象 SObject
     */
    public virtual List<SObject> getRecordsById(String objectApiName, Set<Id> recordIds) {
        // 削除対象 ID がない場合は SOQL を実行せず空結果へ短絡
        Boolean hasSearchCondition = String.isNotBlank(objectApiName) &&
            recordIds != null &&
            !recordIds.isEmpty();
        if (!hasSearchCondition) {
            return new List<SObject>();
        }
        // 指定 ID だけを取得する動的 SOQL を組み立て
        String soql = 'SELECT Id FROM ' +
            objectApiName +
            ' WHERE Id IN :recordIds LIMIT ' +
            recordIds.size();
        Map<String, Object> bindValues = new Map<String, Object>{
            'recordIds' => recordIds
        };

        // 画面利用者の権限で削除対象レコードだけを取得
        return Database.queryWithBinds(
            soql,
            bindValues,
            AccessLevel.USER_MODE
        );
    }

}
