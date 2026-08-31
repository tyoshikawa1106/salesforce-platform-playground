/**
 * オブジェクト件数問い合わせ Coordinator のテスト
 */
@IsTest
private with sharing class ObjectMetricsQueryCoordinatorTest {

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
        List<Integer> visibleRecordCounts;
        Integer executedQueryCount;
        ObjectMetricsOverviewQueryCoordinator queryCoordinator = new ObjectMetricsOverviewQueryCoordinator();

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
        Assert.areEqual(1, visibleRecordCounts[0], '作成済み Account を数える必要あり');
        Assert.areEqual(1, visibleRecordCounts[1], '作成済み Contact を数える必要あり');
        Assert.areEqual(2, executedQueryCount, '取得計画ごとに単一 COUNT SOQL を実行する必要あり');
    }

    /**
     * null の取得計画は SOQL を実行せず空結果を返却
     */
    @IsTest
    static void shouldReturnEmptyResultsWhenCountQueriesAreNull() {
        List<Integer> visibleRecordCounts;
        ObjectMetricsOverviewQueryCoordinator queryCoordinator = new ObjectMetricsOverviewQueryCoordinator();

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
     * null の取得計画要素は SOQL を実行せずゼロ件を返却
     */
    @IsTest
    static void shouldReturnZeroForNullCountQuery() {
        List<Integer> visibleRecordCounts;
        Integer executedQueryCount;
        ObjectMetricsOverviewQueryCoordinator queryCoordinator = new ObjectMetricsOverviewQueryCoordinator();

        System.runAs(testUser) {
            Test.startTest();
            Integer queryCountBeforeExecution = Limits.getQueries();

            visibleRecordCounts = queryCoordinator.execute(
                new List<ObjectMetricsOverviewService.CountQuery>{ null }
            );
            executedQueryCount = Limits.getQueries() - queryCountBeforeExecution;

            Test.stopTest();
        }

        Assert.areEqual(new List<Integer>{ 0 }, visibleRecordCounts, 'null の取得計画要素はゼロ件へ変換する必要あり');
        Assert.areEqual(0, executedQueryCount, 'null の取得計画要素では SOQL を実行しない必要あり');
    }
}