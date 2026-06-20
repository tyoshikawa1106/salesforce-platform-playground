/**
 * Tests object metrics panel summaries.
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {
    @IsTest
    static void shouldReturnObjectMetricSummary() {
        // When
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = ObjectMetricsOverviewController.getObjectMetrics();
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            12,
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
