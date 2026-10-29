/**
 * オブジェクト件数一覧で使う件数 SOQL の実行
 */
public with sharing class ObjectMetricsOverviewSelector {

    /**
     * 作成済みの件数 SOQL を利用者権限で実行
     *
     * @param query 実行する件数 SOQL
     * @return 利用者が参照できるレコード件数、クエリ未指定の場合は 0
     */
    public Integer countVisibleRecords(String query) {
        // クエリ未指定時は SOQL を実行せず 0 件へ短絡
        Boolean hasQuery = String.isNotBlank(query);
        if (!hasQuery) {
            return 0;
        }
        // 問い合わせ失敗は呼び出し元で取得不能として扱う
        Integer visibleRecordCount = Database.countQuery(query);
        // 正常なゼロ件と取得失敗を混同しない
        return visibleRecordCount;
    }
}