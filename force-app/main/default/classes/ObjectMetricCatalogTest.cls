/** メトリクス定義と許可対象のテスト */
@IsTest
private with sharing class ObjectMetricCatalogTest {
    private static User testUser = TestDataFactory.getTestUser();

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

    /** カード順とオブジェクトの対応を維持 */
    @IsTest
    static void preservesDefinitionOrder() {
        System.runAs(testUser) {
            Test.startTest();
            List<ObjectMetricCatalog.MetricDefinition> definitions = ObjectMetricCatalog.getDefinitions();
            ObjectMetricCatalog.MetricDefinition account = ObjectMetricCatalog.getDefinition('accounts');
            Test.stopTest();
            Assert.areEqual(27, definitions.size(), '定義済みの全カードを返す');
            Assert.areEqual('accounts', definitions[0].key, '取引先を先頭へ表示');
            Assert.areEqual('users', definitions[26].key, 'ユーザーを末尾へ表示');
            Assert.areEqual('Account', account.objectApiName, '表示キーを正式なオブジェクトへ対応');
            Assert.areEqual('取引先', account.label, '表示ラベルを維持');
            Assert.areEqual('standard:account', account.iconName, '対象アイコンを維持');
        }
    }

    /** 呼び出し側の一覧変更でカタログを破壊しない */
    @IsTest
    static void isolatesReturnedList() {
        System.runAs(testUser) {
            Test.startTest();
            List<ObjectMetricCatalog.MetricDefinition> definitions = ObjectMetricCatalog.getDefinitions();
            definitions.clear();
            List<ObjectMetricCatalog.MetricDefinition> nextDefinitions = ObjectMetricCatalog.getDefinitions();
            Test.stopTest();
            Assert.areEqual(27, nextDefinitions.size(), '返却一覧の変更を内部定義へ反映しない');
        }
    }

    /** 動的検索の対象を定義済みオブジェクトに限定 */
    @IsTest
    static void restrictsObjectNames() {
        System.runAs(testUser) {
            Test.startTest();
            Boolean allowed = ObjectMetricCatalog.hasObjectApiName('Account');
            Boolean denied = ObjectMetricCatalog.hasObjectApiName('Organization');
            Boolean blank = ObjectMetricCatalog.hasObjectApiName(' ');
            Test.stopTest();
            Assert.isTrue(allowed, '定義済みの対象を許可');
            Assert.isFalse(denied, '未定義の対象を拒否');
            Assert.isFalse(blank, '空白を対象にしない');
        }
    }

    /** nullキーは定義へ解決しない */
    @IsTest
    static void rejectsNullKey() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(null);
            Test.stopTest();
            Assert.isNull(definition, 'nullキーは未定義');
        }
    }
}
