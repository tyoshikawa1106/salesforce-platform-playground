/**
 * オブジェクト件数パネルのサマリをテストします。
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {
    @IsTest
    static void shouldReturnObjectMetricSummary() {
        // 実行
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = ObjectMetricsOverviewController.getObjectMetrics();
            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            27,
            summary.metrics.size(),
            'All object metric cards should have a matching metric item.'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Controller should return the ordered service response.'
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
