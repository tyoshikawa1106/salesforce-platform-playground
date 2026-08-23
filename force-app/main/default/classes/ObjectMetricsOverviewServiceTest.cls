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
        Map<String, ObjectMetricsOverviewService.ObjectMetricCount> metricValues = createMetricValues();

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

    /**
     * カタログ定義と参照権限から件数 SOQL を作成
     */
    @IsTest
    static void shouldCreateCountQueryForConfiguredObject() {
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        ObjectMetricCatalog.MetricDefinition accountDefinition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        List<ObjectMetricCatalog.MetricDefinition> definitions = new List<ObjectMetricCatalog.MetricDefinition>{
            accountDefinition
        };
        List<ObjectMetricsOverviewService.CountQuery> countQueries;

        System.runAs(testUser) {
            Test.startTest();

            countQueries = service.createCountQueries(definitions);

            Test.stopTest();
        }

        Integer countQueryCount = countQueries.size();
        String query = countQueries[0].query;
        Boolean targetsAccount = query.contains('FROM Account');
        Boolean usesUserMode = query.contains('WITH USER_MODE');
        Boolean hasDisplayLimit = query.contains('LIMIT 50000');
        Assert.areEqual(1, countQueryCount, 'Account の取得計画を 1 件作成する必要あり');
        Assert.isTrue(targetsAccount, 'Account を件数取得対象にする必要あり');
        Assert.isTrue(usesUserMode, '利用者権限の件数 SOQL にする必要あり');
        Assert.isTrue(hasDisplayLimit, '件数取得を表示上限で制限する必要あり');
    }

    /**
     * 表示上限以上の件数を capped 状態へ変換
     */
    @IsTest
    static void shouldCapMetricValueAtDisplayLimit() {
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        ObjectMetricCatalog.MetricDefinition accountDefinition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        List<ObjectMetricCatalog.MetricDefinition> definitions = new List<ObjectMetricCatalog.MetricDefinition>{
            accountDefinition
        };
        List<ObjectMetricsOverviewService.CountQuery> countQueries = service.createCountQueries(definitions);
        Map<String, ObjectMetricsOverviewService.ObjectMetricCount> metricValues;

        System.runAs(testUser) {
            Test.startTest();

            metricValues = service.createMetricValues(countQueries, new List<Integer>{ 50000 });

            Test.stopTest();
        }

        ObjectMetricsOverviewService.ObjectMetricCount accountMetric = metricValues.get('accounts');
        Assert.areEqual(50000, accountMetric.value, '表示上限値を維持する必要あり');
        Assert.isTrue(accountMetric.capped, '表示上限到達状態を保持する必要あり');
    }

    /**
     * 件数取得計画が明示上限を超える場合は拒否
     */
    @IsTest
    static void shouldRejectCountQueriesOverExplicitLimit() {
        ObjectMetricsOverviewService service = new ObjectMetricsOverviewService();
        List<ObjectMetricCatalog.MetricDefinition> definitions = new List<ObjectMetricCatalog.MetricDefinition>();
        ObjectMetricCatalog.MetricDefinition accountDefinition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Integer overLimitCount = ObjectMetricsOverviewService.MAX_COUNT_QUERY_COUNT + 1;
        for (Integer index = 0; index < overLimitCount; index++) {
            definitions.add(accountDefinition);
        }

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.createCountQueries(definitions);
                Assert.fail('明示上限を超える件数取得計画は拒否する必要あり');
            } catch (IllegalArgumentException e) {
                String errorMessage = e.getMessage();
                Assert.isNotNull(errorMessage, '計画数超過の理由を返す必要あり');
            }
            Test.stopTest();
        }
    }

    /**
     * サマリ組み立て用の上限到達件数と通常件数を作成
     *
     * @return メトリクスキーごとの件数と上限到達状態
     */
    private static Map<String, ObjectMetricsOverviewService.ObjectMetricCount> createMetricValues() {
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
        List<ObjectMetricsOverviewService.CountQuery> countQueries = service.createCountQueries(definitions);
        Map<String, ObjectMetricsOverviewService.ObjectMetricCount> metricValues = service.createMetricValues(
            countQueries,
            new List<Integer>{ 50000, 34 }
        );
        return metricValues;
    }
}
