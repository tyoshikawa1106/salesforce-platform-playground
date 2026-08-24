/**
 * オブジェクト件数一覧 Selector の件数 SOQL 実行テスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 作成済みの件数 SOQL を利用者権限で実行
     */
    @IsTest
    static void shouldReturnVisibleRecordCount() {
        TestDataFactory.createAccount('件数 Selector テスト', TestDataFactory.SaveMode.INSERT_RECORD);
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition('accounts');
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        List<ObjectMetricCatalog.MetricDefinition> definitions = new List<ObjectMetricCatalog.MetricDefinition>{
            definition
        };
        List<ObjectMetricsOverviewService.CountQuery> countQueries = service.createCountQueries(
            definitions
        );
        String query = countQueries[0].query;
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = selector.countVisibleRecords(query);

            Test.stopTest();
        }

        Assert.areEqual(1, result, '作成済み取引先の参照可能件数を返す必要あり');
    }

    /**
     * クエリ未指定時は SOQL を実行せず 0 件を返却
     */
    @IsTest
    static void shouldReturnZeroWhenQueryIsBlank() {
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = new ObjectMetricsOverviewSelector().countVisibleRecords(' ');

            Test.stopTest();
        }

        Assert.areEqual(0, result, '空白クエリは 0 件を返す必要あり');
    }

    /**
     * 組織で実行できない件数 SOQL は画面を止めず 0 件へ変換
     */
    @IsTest
    static void shouldReturnZeroWhenCountQueryFails() {
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = new ObjectMetricsOverviewSelector().countVisibleRecords(
                'SELECT COUNT() FROM UnknownObject__c WITH USER_MODE LIMIT 50000'
            );

            Test.stopTest();
        }

        Assert.areEqual(0, result, '実行できない件数 SOQL は 0 件を返す必要あり');
    }
}