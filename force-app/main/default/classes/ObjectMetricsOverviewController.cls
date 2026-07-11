/**
 * データボード LWC に表示するレコード件数サマリ提供
 */
public with sharing class ObjectMetricsOverviewController {

    @TestVisible
    private static ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
    @TestVisible
    private static ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

    /**
     * 現在のユーザーが参照できる各オブジェクトの件数取得
     *
     * @return LWC 表示順に整列済みのレコード件数サマリ
     */
    @AuraEnabled(cacheable=true)
    public static ObjectMetricsOverviewSummaryWrapper getObjectMetrics() {
        try {
            // 件数結果を画面表示順のサマリへ変換
            Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricValues = selector.getObjectMetricValues();
            return service.createObjectMetrics(metricValues);
        } catch (Exception e) {
            throw new AuraHandledException('データボードを表示できませんでした。時間をおいてもう一度お試しください。');
        }
    }
}