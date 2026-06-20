/**
 * Tests object metrics overview service behavior.
 */
@IsTest
private with sharing class ObjectMetricsOverviewServiceTest {
    @IsTest
    static void shouldBuildOrderedSummaryFromSelectorValues() {
        // Given
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService(
            new StubObjectMetricsOverviewSelector()
        );

        // When
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = service.getObjectMetrics();
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            15,
            summary.metrics.size(),
            'Service should return all configured metric items.'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Account metric should be first.'
        );
        Assert.areEqual(
            50000,
            summary.metrics[0].value,
            'Capped account value should be preserved.'
        );
        Assert.isTrue(
            summary.metrics[0].capped,
            'Capped account value should carry the capped marker.'
        );
        Assert.areEqual(
            'contacts',
            summary.metrics[1].key,
            'Contact metric should be second.'
        );
        Assert.areEqual(
            34,
            summary.metrics[1].value,
            'Contact value should come from the selector.'
        );
        Assert.isFalse(
            summary.metrics[1].capped,
            'Exact contact value should not carry the capped marker.'
        );
        Assert.areEqual(
            'opportunities',
            summary.metrics[2].key,
            'Opportunity metric should be third.'
        );
        Assert.areEqual(
            'recycleBinItems',
            summary.metrics[14].key,
            'Recycle Bin metric should be last.'
        );
    }

    @IsTest
    static void shouldUseDefaultSelectorWhenSelectorIsNull() {
        // Given
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService(
            null
        );

        // When
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = service.getObjectMetrics();
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            15,
            summary.metrics.size(),
            'Service should fall back to the default selector.'
        );
    }

    private class StubObjectMetricsOverviewSelector extends ObjectMetricsOverviewSelector {
        public override Map<String, ObjectMetricCount> getObjectMetricValues() {
            return new Map<String, ObjectMetricCount>{
                'accounts' => ObjectMetricsOverviewSelector.createCount(50000),
                'contacts' => ObjectMetricsOverviewSelector.createCount(34)
            };
        }
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
