/**
 * オブジェクト件数カード Wrapper テスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewItemWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 定義と件数から表示用メトリクス行を作成
     */
    @IsTest
    static void shouldCreateItemFromDefinitionAndMetricCount() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        ObjectMetricsOverviewItemWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectMetricsOverviewItemWrapper(
                definition,
                ObjectMetricsOverviewSelector.createCount(50000)
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            wrapper.key,
            'Wrapper はメトリクスキーを公開する必要あり'
        );
        Assert.areEqual(
            'Account',
            wrapper.objectApiName,
            'Wrapper はオブジェクト API 名を公開する必要あり'
        );
        Assert.areEqual(
            '取引先',
            wrapper.label,
            'Wrapper は表示ラベルを公開する必要あり'
        );
        Assert.areEqual(
            'standard:account',
            wrapper.iconName,
            'Wrapper はアイコン名を公開する必要あり'
        );
        Assert.areEqual(
            50000,
            wrapper.value,
            'Wrapper はメトリクス値を公開する必要あり'
        );
        Assert.isTrue(
            wrapper.capped,
            'Wrapper は上限到達フラグを公開する必要あり'
        );
    }

    /**
     * 件数が未取得のメトリクスは 0 件として表示
     */
    @IsTest
    static void shouldDefaultMissingMetricCountToZero() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'contacts'
        );
        ObjectMetricsOverviewItemWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectMetricsOverviewItemWrapper(definition, null);

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            wrapper.value,
            '不足しているメトリクス件数は 0 にする必要あり'
        );
        Assert.isFalse(
            wrapper.capped,
            '不足しているメトリクス件数は上限到達扱いにしない必要あり'
        );
    }
}