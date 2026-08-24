/**
 * 汎用レコード検索の問い合わせ条件検証テスト
 */
@IsTest
private with sharing class ObjectRecordSearchQueryPlanTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 必須値と許可済み識別子を持つ問い合わせ条件を返却
     */
    @IsTest
    static void shouldReturnValidSearchQueryRequest() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            context
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(
                request
            );

            Test.stopTest();
        }

        Assert.isNotNull(
            result,
            '検証済みの問い合わせ条件を Selector へ渡す必要あり'
        );
        Assert.areEqual(
            51,
            result.fetchSize,
            '検証後も取得件数を保つ必要あり'
        );
    }

    /**
     * 検索条件未指定時は例外を送出
     */
    @IsTest
    static void shouldThrowWhenRequestIsMissing() {

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(null);
                Assert.fail('問い合わせ条件未指定は例外にする必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    '問い合わせ条件未指定は検索条件の不正を説明する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    /**
     * 許可されていないソート項目は例外を送出
     */
    @IsTest
    static void shouldThrowWhenSortFieldIsNotAllowed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            context
        );
        request.sortSpec.fieldApiName = 'Description';

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(
                    request
                );
                Assert.fail('許可されていないソート項目は例外にする必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    '許可されていないソート項目は検索条件の不正を説明する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    /**
     * 許可されていないソート方向は例外を送出
     */
    @IsTest
    static void shouldThrowWhenSortDirectionIsNotAllowed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            context
        );
        request.sortSpec.direction = 'invalid';

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(
                    request
                );
                Assert.fail('許可されていないソート方向は例外にする必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    '許可されていないソート方向は検索条件の不正を説明する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    /**
     * 固定取得件数と異なる問い合わせ条件は例外を送出
     */
    @IsTest
    static void shouldThrowWhenFetchSizeIsUnexpected() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            context
        );
        request.fetchSize = 52;

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(
                    request
                );
                Assert.fail('固定取得件数と異なる問い合わせ条件は拒否する必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    '不正な取得件数は検索条件の不正を説明する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    private static ObjectRecordSearchQueryPlan.SearchQueryRequest createSearchQueryRequest(ObjectRecordSearchContext context) {
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        request.context = context;
        request.searchRequest = new ObjectRecordSearchRequestWrapper();
        request.sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            request.searchRequest
        );
        request.fetchSize = ObjectRecordSearchQueryPlan.SEARCH_FETCH_SIZE;
        return request;
    }

    private static ObjectRecordSearchContext createAccountContext() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Schema.DescribeFieldResult nameFieldDescribe = Account.Name.getDescribe();
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            nameFieldDescribe,
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
            nameFieldDescribe,
            objectDescribe
        );
    }
}