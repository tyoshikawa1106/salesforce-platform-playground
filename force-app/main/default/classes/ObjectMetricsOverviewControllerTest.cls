/**
 * オブジェクト件数パネルのサマリテスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * オブジェクト件数サマリーを画面用に返却
     */
    @IsTest
    static void shouldReturnObjectMetricSummary() {
        createObjectMetricRecords();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;

        System.runAs(testUser) {
            Test.startTest();

            // Controller 経由で画面用メトリクス一覧を組み立て
            summary = ObjectMetricsOverviewController.getObjectMetrics();

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'すべてのメトリクスカードに対応する項目が必要'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Controller は Service の並び順を保って返す必要あり'
        );
        ObjectMetricsOverviewItemWrapper accountMetric = getMetric(summary, 'accounts');
        ObjectMetricsOverviewItemWrapper contactMetric = getMetric(summary, 'contacts');
        ObjectMetricsOverviewItemWrapper leadMetric = getMetric(summary, 'leads');
        ObjectMetricsOverviewItemWrapper opportunityMetric = getMetric(
            summary,
            'opportunities'
        );
        ObjectMetricsOverviewItemWrapper productMetric = getMetric(summary, 'products');
        ObjectMetricsOverviewItemWrapper caseMetric = getMetric(summary, 'cases');
        Assert.areEqual(1, accountMetric.value, '作成済み Account を数える必要あり');
        Assert.areEqual(1, contactMetric.value, '作成済み Contact を数える必要あり');
        Assert.areEqual(1, leadMetric.value, '作成済み Lead を数える必要あり');
        Assert.areEqual(
            1,
            opportunityMetric.value,
            '作成済み Opportunity を数える必要あり'
        );
        Assert.areEqual(1, productMetric.value, '作成済み Product を数える必要あり');
        Assert.areEqual(1, caseMetric.value, '作成済み Case を数える必要あり');
    }

    /**
     * サマリから指定キーのメトリクスを取得
     *
     * @param summary 検索対象のオブジェクト件数サマリ
     * @param metricKey 取得するメトリクスキー
     * @return 指定キーのメトリクス、存在しない場合は null
     */
    private static ObjectMetricsOverviewItemWrapper getMetric(
        ObjectMetricsOverviewSummaryWrapper summary,
        String metricKey
    ) {
        for (ObjectMetricsOverviewItemWrapper metric : summary.metrics) {
            if (metric.key == metricKey) {
                return metric;
            }
        }
        return null;
    }

    /**
     * 主要オブジェクトの実件数確認用レコードを作成
     */
    private static void createObjectMetricRecords() {
        Account accountRecord = new Account(Name = 'Controller 件数取引先');
        insert accountRecord;
        insert new Contact(AccountId = accountRecord.Id, LastName = 'Controller 件数責任者');
        insert new Lead(LastName = 'Controller 件数リード', Company = 'Controller 件数会社');
        insert new Opportunity(AccountId = accountRecord.Id, Name = 'Controller 件数商談', StageName = 'Prospecting', CloseDate = Date.today().addDays(30));
        insert new Product2(Name = 'Controller 件数商品', IsActive = true);
        insert new Case(Subject = 'Controller 件数ケース');
    }

}