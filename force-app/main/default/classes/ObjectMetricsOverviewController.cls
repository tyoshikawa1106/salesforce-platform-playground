/**
 * データボード LWC に表示するレコード件数サマリを提供します。
 *
 * LWC から直接呼ばれる公開入口だけを持ち、集計順序や件数取得の詳細は
 * ObjectMetricsOverviewService / Selector に委譲します。
 */
public with sharing class ObjectMetricsOverviewController {
    @TestVisible
    private static ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();

    @TestVisible
    private static ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

    /**
     * 現在のユーザーが参照できる各オブジェクトの件数を取得します。
     *
     * cacheable=true の読み取り専用メソッドとして LWC wire から利用します。
     * 内部例外は LWC に詳細を出さず、画面表示用の共通メッセージに変換します。
     * @return LWC 表示順に整列済みのレコード件数サマリ
     */
    @AuraEnabled(cacheable=true)
    public static ObjectMetricsOverviewSummaryWrapper getObjectMetrics() {
        try {
            return service.createObjectMetrics(
                selector.getObjectMetricValues()
            );
        } catch (Exception error) {
            throw new AuraHandledException(
                'データボードを読み込めませんでした。'
            );
        }
    }
}
