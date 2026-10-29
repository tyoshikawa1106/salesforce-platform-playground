/**
 * 固定カタログに含まれる異なる SObject の件数問い合わせを調整
 *
 * 異なる SObject の COUNT は単一 SOQL に統合できないため、Service が許可リストから
 * 作成した最大 50 件の計画に限り、残りの SOQL 枠を確認して Selector を順次呼び出す。
 * 通常の Selector として再利用せず、複数問い合わせの実行境界だけを担当する。
 */
public with sharing class ObjectMetricsOverviewQueryRunner {

    // 検証済みの単一件数 SOQL 実行を Selector へ委譲
    private ObjectMetricsOverviewSelector selector;

    /**
     * 本番用 Selector で Coordinator を初期化
     */
    public ObjectMetricsOverviewQueryRunner() {
        // 固定カタログの件数取得に使う Selector を設定
        this.selector = new ObjectMetricsOverviewSelector();
    }

    /**
     * 固定カタログの件数取得計画を明示上限内で実行
     *
     * @param countQueries Service が許可リストから作成した最大 50 件の取得計画
     * @return 取得計画と同じ順序の取得状態付き件数
     * @throws IllegalArgumentException SOQL の残り枠を超える場合
     */
    public List<ObjectMetricsOverviewService.ObjectMetricCount> execute(
        List<ObjectMetricsOverviewService.CountQuery> countQueries
    ) {
        // null の取得計画は空の一覧へ正規化
        List<ObjectMetricsOverviewService.CountQuery> safeCountQueries = countQueries == null
            ? new List<ObjectMetricsOverviewService.CountQuery>()
            : countQueries;
        // 現在トランザクションで実行できる残り SOQL 数を算出
        Integer remainingQueryCount = Limits.getLimitQueries() - Limits.getQueries();
        // 明示上限または残り SOQL 枠を超える取得計画は実行前に拒否
        Integer executableQueryCount = Math.min(
            ObjectMetricsOverviewService.MAX_COUNT_QUERY_COUNT,
            remainingQueryCount
        );
        // 実行予定の件数 SOQL 数を上限判定用に確定
        Integer plannedQueryCount = safeCountQueries.size();
        // 計画数が現在実行できる SOQL 数を超える場合は処理を拒否
        if (plannedQueryCount > executableQueryCount) {
            // ガバナ制限到達前に利用者向け例外へ変換
            throw new IllegalArgumentException(
                'オブジェクト件数の取得に必要な SOQL 枠が不足しています。'
            );
        }
        // 取得計画と同じ順序の取得状態付き件数を保持
        List<ObjectMetricsOverviewService.ObjectMetricCount> visibleRecordCounts = new List<ObjectMetricsOverviewService.ObjectMetricCount>();
        // 異なる SObject の COUNT は統合できないため専用境界で順次実行
        for (ObjectMetricsOverviewService.CountQuery countQuery : safeCountQueries) {
            // null の取得計画は SOQL を実行せず未取得として扱う
            String query = countQuery == null ? '' : countQuery.query;
            // 計画なしと取得失敗は正常なゼロ件から分離
            ObjectMetricsOverviewService.ObjectMetricCount result = new ObjectMetricsOverviewService.ObjectMetricCount();
            // 権限や機能が利用可能な問い合わせだけを実行
            if (String.isNotBlank(query)) {
                try {
                    // 取得に成功した件数を保持
                    Integer value = this.selector.countVisibleRecords(query);
                    // 既存の件数型で取得状態と表示上限を確定
                    result = new ObjectMetricsOverviewService.ObjectMetricCount(value);
                } catch (QueryException e) {
                    // 他のカードの取得を継続し、このカードだけ取得不能を通知
                    result.available = false;
                }
            }
            // 計画と同じ順序で取得状態を返却
            visibleRecordCounts.add(result);
        }
        // 取得計画と位置対応する取得状態付き件数を返却
        return visibleRecordCounts;
    }

}