/**
 * オブジェクト件数問い合わせ Coordinator のテスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewQueryRunnerTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 異なる SObject の件数取得計画を順番に実行
     */
    @IsTest
    static void shouldExecuteConfiguredCrossObjectCountQueries() {
        Account accountRecord = TestDataFactory.createAccount(
            'Coordinator 件数取引先',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createContact(
            accountRecord,
            'Coordinator 件数責任者',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        ObjectMetricCatalog.MetricDefinition accountDefinition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        ObjectMetricCatalog.MetricDefinition contactDefinition = ObjectMetricCatalog.getDefinition(
            'contacts'
        );
        List<ObjectMetricCatalog.MetricDefinition> definitions = new List<ObjectMetricCatalog.MetricDefinition>{
            accountDefinition,
            contactDefinition
        };
        List<ObjectMetricsOverviewService.CountQuery> countQueries = service.createCountQueries(
            definitions
        );
        List<ObjectMetricsOverviewService.ObjectMetricCount> visibleRecordCounts;
        Integer executedQueryCount;
        ObjectMetricsOverviewQueryRunner queryCoordinator = new ObjectMetricsOverviewQueryRunner();

        System.runAs(testUser) {
            Test.startTest();
            Integer queryCountBeforeExecution = Limits.getQueries();

            visibleRecordCounts = queryCoordinator.execute(countQueries);
            executedQueryCount = Limits.getQueries() - queryCountBeforeExecution;

            Test.stopTest();
        }

        // 取得計画と結果の件数対応を確認
        Integer resultCount = visibleRecordCounts.size();
        Assert.areEqual(2, resultCount, '取得計画と同じ数の結果を返す必要あり');
        Assert.areEqual(1, visibleRecordCounts[0].value, '作成済み Account を数える必要あり');
        Assert.areEqual(1, visibleRecordCounts[1].value, '作成済み Contact を数える必要あり');
        Assert.areEqual(2, executedQueryCount, '取得計画ごとに単一 COUNT SOQL を実行する必要あり');
    }

    /**
     * null の取得計画は SOQL を実行せず空結果を返却
     */
    @IsTest
    static void shouldReturnEmptyResultsWhenCountQueriesAreNull() {
        List<ObjectMetricsOverviewService.ObjectMetricCount> visibleRecordCounts;
        ObjectMetricsOverviewQueryRunner queryCoordinator = new ObjectMetricsOverviewQueryRunner();

        System.runAs(testUser) {
            Test.startTest();

            visibleRecordCounts = queryCoordinator.execute(null);

            Test.stopTest();
        }

        // null 入力で結果が追加されていないことを確認
        Integer resultCount = visibleRecordCounts.size();
        Assert.areEqual(0, resultCount, 'null の取得計画は空結果にする必要あり');
    }

    /**
     * null の取得計画要素は SOQL を実行せず未取得を返却
     */
    @IsTest
    static void shouldMarkNullCountQueryUnavailable() {
        List<ObjectMetricsOverviewService.ObjectMetricCount> visibleRecordCounts;
        Integer executedQueryCount;
        ObjectMetricsOverviewQueryRunner queryCoordinator = new ObjectMetricsOverviewQueryRunner();

        System.runAs(testUser) {
            Test.startTest();
            Integer queryCountBeforeExecution = Limits.getQueries();

            visibleRecordCounts = queryCoordinator.execute(
                new List<ObjectMetricsOverviewService.CountQuery>{ null }
            );
            executedQueryCount = Limits.getQueries() - queryCountBeforeExecution;

            Test.stopTest();
        }

        Assert.isFalse(visibleRecordCounts[0].available, '未実行のカードを正常なゼロ件と区別');
        Assert.areEqual(0, executedQueryCount, 'null の取得計画要素では SOQL を実行しない必要あり');
    }

    /** 一つの取得失敗を正常なゼロ件と区別して他のカードを継続 */
    @IsTest
    static void preservesAvailabilityWhenOneQueryFails() {
        ObjectMetricsOverviewQueryRunner coordinator = new ObjectMetricsOverviewQueryRunner();
        // 本体の非公開コンストラクタを広げず取得失敗の入力だけを再現
        List<ObjectMetricsOverviewService.CountQuery> plans = (List<ObjectMetricsOverviewService.CountQuery>) JSON.deserialize(
            '[{"metricKey":"invalid","query":"SELECT COUNT() FROM MissingMetricObject__c WITH USER_MODE"},' +
            '{"metricKey":"accounts","query":"SELECT COUNT() FROM Account WITH USER_MODE"}]',
            List<ObjectMetricsOverviewService.CountQuery>.class
        );
        System.runAs(testUser) {
            Test.startTest();
            List<ObjectMetricsOverviewService.ObjectMetricCount> counts = coordinator.execute(plans);
            Test.stopTest();
            Assert.areEqual(2, counts.size(), '取得計画との位置対応を維持');
            Assert.isFalse(counts[0].available, '失敗した取得をゼロ件と表示しない');
            Assert.isTrue(counts[1].available, '別の正常な取得を継続');
            Assert.areEqual(0, counts[1].value, '正常なゼロ件を取得済みとして保持');
        }
    }
}
