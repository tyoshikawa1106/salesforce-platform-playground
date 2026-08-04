/**
 * オブジェクト件数一覧で使う件数 SOQL の実行
 */
public virtual with sharing class ObjectMetricsOverviewSelector {

    /**
     * 作成済みの件数 SOQL を利用者権限で実行
     *
     * @param query 実行する件数 SOQL
     * @return 利用者が参照できるレコード件数、クエリ未指定の場合は 0
     */
    public virtual Integer countVisibleRecords(String query) {
        // クエリ未指定時は SOQL を実行せず 0 件へ短絡
        Boolean hasQuery = String.isNotBlank(query);
        if (!hasQuery) {
            return 0;
        }
        try {
            // Service が検証した件数 SOQL を実行して未加工の件数を返却
            Integer visibleRecordCount = Database.countQuery(query);
            // Coordinator へ未加工の参照可能件数を返却
            return visibleRecordCount;
        } catch (QueryException e) {
            // 組織差で件数取得できないオブジェクトは画面を止めず 0 件として返却
            return 0;
        }
    }
}
