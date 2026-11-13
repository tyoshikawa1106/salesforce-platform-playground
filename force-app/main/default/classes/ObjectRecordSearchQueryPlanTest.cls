/**
 * 汎用レコード検索の問い合わせ条件検証テスト
 */
@IsTest
private with sharing class ObjectRecordSearchQueryPlanTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

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
            50,
            result.fetchSize,
            '検証後も取得件数を保つ必要あり'
        );
    }

    /** 小さい取得件数を受け入れ、ゼロ以下と未指定を拒否 */
    @IsTest
    static void validatesSmallFetchSizes() {
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(createAccountContext());

        System.runAs(testUser) {
            Test.startTest();
            request.fetchSize = 2;
            Assert.areEqual(2, ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(request).fetchSize, '小さい取得件数を保持');
            for (Integer invalidSize : new List<Integer>{ null, 0, -1 }) {
                request.fetchSize = invalidSize;
                try {
                    ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(request);
                    Assert.fail('取得件数は正の値が必要');
                } catch (IllegalArgumentException e) {
                    Assert.isTrue(e.getMessage().contains('必須値'), '無効な取得件数を拒否');
                }
            }
            Test.stopTest();
        }
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
     * 取得上限を超える問い合わせ条件は例外を送出
     */
    @IsTest
    static void shouldThrowWhenFetchSizeIsUnexpected() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            context
        );
        request.fetchSize = 51;

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(
                    request
                );
                Assert.fail('取得上限を超える問い合わせ条件は拒否する必要あり');
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