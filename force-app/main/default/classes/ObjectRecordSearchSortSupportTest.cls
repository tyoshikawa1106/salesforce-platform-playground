/**
 * 汎用レコード検索のソート・ページング補助テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSortSupportTest {
    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupData() {
        insert new Account(
            Name = 'Cursor Account',
            Industry = 'Technology'
        );
    }

    /**
     * ソート指定なしの場合は既定ソート条件を作成
     */
    @IsTest
    static void shouldCreateDefaultSortSpecWhenSortRequestIsMissing() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec;

        System.runAs(testUser) {
            Test.startTest();

            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                context,
                new ObjectRecordSearchRequestWrapper()
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Name',
            sortSpec.fieldApiName,
            'ソート指定がない場合は名前項目を使う必要あり'
        );
        Assert.areEqual(
            'asc',
            sortSpec.direction,
            'ソート方向がない場合は昇順を使う必要あり'
        );
    }

    /**
     * 許可項目のソート指定からソート条件を作成
     */
    @IsTest
    static void shouldCreateRequestedSortSpecWhenFieldIsAllowed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Industry';
        request.sortDirection = 'desc';
        ObjectRecordSearchSortSupport.SortSpec sortSpec;

        System.runAs(testUser) {
            Test.startTest();

            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                context,
                request
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Industry',
            sortSpec.fieldApiName,
            '許可されたソート項目は維持する必要あり'
        );
        Assert.areEqual(
            'desc',
            sortSpec.direction,
            '降順指定は維持する必要あり'
        );
    }

    /**
     * ソート不可項目は Name ソートへ切り替え
     */
    @IsTest
    static void shouldFallbackToNameWhenSortFieldIsNotSortable() {
        ObjectRecordSearchContext context = createAccountContextWithDescription();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Description';
        ObjectRecordSearchSortSupport.SortSpec sortSpec;

        System.runAs(testUser) {
            Test.startTest();

            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                context,
                request
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Name',
            sortSpec.fieldApiName,
            'ソート不可の表示項目は名前項目へフォールバックする必要あり'
        );
    }

    private static ObjectRecordSearchContext createAccountContext() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            objectDescribe.fields.getMap().get('Name').getDescribe(),
            objectDescribe
        )
            .withDisplayFields(new List<ObjectRecordSearchFieldWrapper>{
                new ObjectRecordSearchFieldWrapper(
                    'Industry',
                    'Industry',
                    'text'
                )
            });
        return service.createSearchContext(
            config,
            objectDescribe.fields.getMap().get('Name').getDescribe(),
            objectDescribe
        );
    }

    private static ObjectRecordSearchContext createAccountContextWithDescription() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Schema.DescribeFieldResult nameFieldDescribe = objectDescribe.fields
            .getMap()
            .get('Name')
            .getDescribe();
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        )
            .withDisplayFields(new List<ObjectRecordSearchFieldWrapper>{
                new ObjectRecordSearchFieldWrapper(
                    'Description',
                    'Description',
                    'text'
                )
            });
        return service.createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
    }

}
