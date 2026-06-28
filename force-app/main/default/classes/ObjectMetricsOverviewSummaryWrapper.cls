/**
 * オブジェクト件数結果を LWC に返す Wrapper です。
 */
public with sharing class ObjectMetricsOverviewSummaryWrapper {
    /**
     * LWC に表示する順序付きの件数項目です。
     */
    @AuraEnabled
    public List<ObjectMetricsOverviewItemWrapper> metrics { get; private set; }

    /**
     * 順序付き件数項目を保持するサマリを作成します。
     * @param metrics LWC に返す順序付き件数項目
     */
    public ObjectMetricsOverviewSummaryWrapper(
        List<ObjectMetricsOverviewItemWrapper> metrics
    ) {
        this.metrics = metrics == null
            ? new List<ObjectMetricsOverviewItemWrapper>()
            : metrics;
    }
}