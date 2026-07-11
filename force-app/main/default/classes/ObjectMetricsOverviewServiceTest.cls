/**
 * オブジェクト件数一覧サービスの振る舞いテスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewServiceTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * メトリクス定義順でサマリーを作成
     */
    @IsTest
    static void shouldBuildOrderedSummaryFromMetricValues() {
        // 準備
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricValues = createMetricValues();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;

        System.runAs(testUser) {
            Test.startTest();

            // カタログ順の画面表示用サマリへ集計値を変換
            summary = service.createObjectMetrics(metricValues);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'Service は設定済みメトリクス項目をすべて返す必要あり'
        );
        Assert.areEqual(
            'accounts',
            summary.metrics[0].key,
            'Account メトリクスは先頭にする必要あり'
        );
        Assert.areEqual(
            50000,
            summary.metrics[0].value,
            '上限到達した Account 値は維持する必要あり'
        );
        Assert.areEqual(
            'standard:account',
            summary.metrics[0].iconName,
            'Account メトリクスは catalog のカードアイコンを持つ必要あり'
        );
        Assert.isTrue(
            summary.metrics[0].capped,
            '上限到達した Account 値は上限到達フラグを持つ必要あり'
        );
        Assert.areEqual(
            'contacts',
            summary.metrics[1].key,
            'Contact メトリクスは 2 番目にする必要あり'
        );
        Assert.areEqual(
            34,
            summary.metrics[1].value,
            'Contact 値は指定されたメトリクス値を使う必要あり'
        );
        Assert.isFalse(
            summary.metrics[1].capped,
            '正確な Contact 値は上限到達フラグを持たない必要あり'
        );
        Assert.areEqual(
            'leads',
            summary.metrics[2].key,
            'Lead メトリクスは 3 番目にする必要あり'
        );
        Assert.areEqual(
            'users',
            summary.metrics[26].key,
            'User メトリクスは最後にする必要あり'
        );
    }

    /**
     * メトリクス件数が null の場合は 0 件サマリーを作成
     */
    @IsTest
    static void shouldReturnZeroValuesWhenMetricValuesAreNull() {
        // 準備
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();

        // 実行
        ObjectMetricsOverviewSummaryWrapper summary;

        System.runAs(testUser) {
            Test.startTest();

            // 集計値がない場合のゼロ埋めサマリを生成
            summary = service.createObjectMetrics(null);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            summary.metrics.size(),
            'Service は設定済みメトリクス項目をすべて返す必要あり'
        );
        Assert.areEqual(
            0,
            summary.metrics[0].value,
            '不足しているメトリクス値は 0 にする必要あり'
        );
        Assert.isFalse(
            summary.metrics[0].capped,
            '不足しているメトリクス値は上限到達扱いにしない必要あり'
        );
    }

    /**
     * メトリクス定義の有無をキーで判定
     */
    @IsTest
    static void shouldResolveMetricDefinitionPresence() {
        Boolean hasAccounts;
        Boolean hasUnknownMetric;
        ObjectMetricCatalog.MetricDefinition blankDefinition;

        System.runAs(testUser) {
            Test.startTest();

            // カタログが既知キー、未知キー、空白キーを判別
            hasAccounts = ObjectMetricCatalog.hasDefinition('accounts');
            hasUnknownMetric = ObjectMetricCatalog.hasDefinition('unknown');
            blankDefinition = ObjectMetricCatalog.getDefinition(' ');

            Test.stopTest();
        }

        Assert.isTrue(
            hasAccounts,
            'Catalog は設定済みメトリクスキーを存在ありとして返す必要あり'
        );
        Assert.isFalse(
            hasUnknownMetric,
            'Catalog は未知のメトリクスキーを存在なしとして返す必要あり'
        );
        Assert.isNull(
            blankDefinition,
            '空白のメトリクスキーは定義に解決しない必要あり'
        );
    }

    private static Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> createMetricValues() {
        return new Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount>{
            'accounts' => ObjectMetricsOverviewSelector.createCount(50000),
            'contacts' => ObjectMetricsOverviewSelector.createCount(34)
        };
    }
}