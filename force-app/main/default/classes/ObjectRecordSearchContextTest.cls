/**
 * 汎用レコード検索の内部処理 Context テスト
 */
@IsTest
private with sharing class ObjectRecordSearchContextTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 検索コンテキストから設定と許可項目を作成
     */
    @IsTest
    static void shouldCreateConfigAndAllowedFields() {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        List<ObjectRecordSearchFieldWrapper> displayFields = new List<ObjectRecordSearchFieldWrapper>{
            new ObjectRecordSearchFieldWrapper('Industry', 'Industry', 'text'),
            new ObjectRecordSearchFieldWrapper('MissingField__c', '存在しない項目', 'text')
        };
        ObjectRecordSearchContext context;

        System.runAs(testUser) {
            Test.startTest();

            context = new ObjectRecordSearchContext(
                new ObjectRecordSearchConfigWrapper(
                        definition,
                        Account.Name.getDescribe(),
                        objectDescribe
                    )
                    .withDisplayFields(displayFields),
                Account.Name.getDescribe(),
                objectDescribe
            );

            Test.stopTest();
        }

        Assert.isTrue(context.getQueryFieldApiNames().contains('Industry'), '設定済みの実在項目を検索へ含める');
        Assert.isFalse(context.getQueryFieldApiNames().contains('MissingField__c'), '存在しない表示項目を検索から除外');
        Assert.areEqual(
            'accounts',
            context.config.metricKey,
            'Context は LWC config wrapper を公開する必要あり'
        );
        Assert.isTrue(
            context.getAllowedFieldApiNames().contains('Industry'),
            'Context は設定済み表示項目のソートを許可する必要あり'
        );
        Assert.areEqual(
            Schema.DisplayType.PICKLIST,
            context.getAllowedFieldDescribe('Industry').getType(),
            'Context はカーソル解析用の項目 describe を保つ必要あり'
        );
    }
}