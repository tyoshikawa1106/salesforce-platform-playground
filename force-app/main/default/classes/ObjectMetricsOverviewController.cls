/**
 * データボード LWC に表示するレコード件数サマリを提供します。
 */
public with sharing class ObjectMetricsOverviewController {
    @TestVisible
    private static ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();

    @TestVisible
    private static ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

    /**
     * 現在のユーザーが参照できる各オブジェクトの件数を取得します。
     *
     * @return LWC 表示順に整列済みのレコード件数サマリ。
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
