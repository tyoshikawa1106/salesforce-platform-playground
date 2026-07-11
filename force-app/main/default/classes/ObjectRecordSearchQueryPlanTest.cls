/**
 * 汎用レコード検索の SOQL 組み立てテスト
 */
@IsTest
private with sharing class ObjectRecordSearchQueryPlanTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 検索条件とカーソル条件を含む SOQL を作成
     */
    @IsTest
    static void shouldCreateQueryWithSearchAndCursorConditions() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.searchTerm = ' Query ';
        request.sortBy = 'Industry';
        request.sortDirection = 'desc';
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.sortValue = 'Technology';
        cursor.recordId = TestDataFactory.createAccount('Query Cursor', TestDataFactory.SaveMode.INSERT_RECORD).Id;
        ObjectRecordSearchQueryPlan.SearchQueryRequest queryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        queryRequest.context = context;
        queryRequest.searchRequest = request;
        queryRequest.sortSpec = sortSpec;
        queryRequest.cursor = cursor;
        queryRequest.fetchSize = 51;
        ObjectRecordSearchQueryPlan.SearchQuery query;

        System.runAs(testUser) {
            Test.startTest();

            query = ObjectRecordSearchQueryPlan.createSearchQuery(queryRequest);

            Test.stopTest();
        }

        Assert.isTrue(
            query.soql.contains('Name LIKE :nameSearchTerm'),
            '検索クエリはバインド済み Name 検索条件を含む必要あり'
        );
        Assert.isTrue(
            query.soql.contains('Industry < :cursorSortValue'),
            '降順カーソルクエリは小なり演算子で比較する必要あり'
        );
        Assert.isTrue(
            query.soql.contains('ORDER BY Industry DESC NULLS LAST, Id ASC LIMIT 51'),
            'クエリは指定されたソートと取得件数を保つ必要あり'
        );
        Assert.areEqual(
            '%Query%',
            query.bindValues.get('nameSearchTerm'),
            '検索語は trim して LIKE 用に囲む必要あり'
        );
        Assert.areEqual(
            cursor.sortValue,
            query.bindValues.get('cursorSortValue'),
            'カーソルのソート値はバインド値として公開する必要あり'
        );
        Assert.areEqual(
            cursor.recordId,
            query.bindValues.get('cursorRecordId'),
            'カーソルのレコード ID はバインド値として公開する必要あり'
        );
    }

    /**
     * 検索条件とカーソル条件なしで基本 SOQL を作成
     */
    @IsTest
    static void shouldCreateQueryWithoutWhereWhenSearchAndCursorAreMissing() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest queryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        queryRequest.context = context;
        queryRequest.searchRequest = request;
        queryRequest.sortSpec = sortSpec;
        queryRequest.fetchSize = 51;
        ObjectRecordSearchQueryPlan.SearchQuery query;

        System.runAs(testUser) {
            Test.startTest();

            query = ObjectRecordSearchQueryPlan.createSearchQuery(queryRequest);

            Test.stopTest();
        }

        Assert.isFalse(
            query.soql.contains(' WHERE '),
            'カーソルなしの空白検索は WHERE 句を追加しない必要あり'
        );
        Assert.areEqual(
            0,
            query.bindValues.size(),
            'カーソルなしの空白検索はバインド値を追加しない必要あり'
        );
    }

    /**
     * 検索リクエスト未指定時は例外を送出
     */
    @IsTest
    static void shouldThrowWhenRequestIsMissing() {

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.createSearchQuery(null);
                Assert.fail('クエリリクエスト未指定は例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    'クエリリクエスト未指定は検索条件の不正を説明する必要あり'
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
        ObjectRecordSearchQueryPlan.SearchQueryRequest queryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        queryRequest.context = context;
        queryRequest.searchRequest = new ObjectRecordSearchRequestWrapper();
        queryRequest.sortSpec = new ObjectRecordSearchSortSupport.SortSpec();
        queryRequest.sortSpec.fieldApiName = 'Description';
        queryRequest.fetchSize = 51;

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchQueryPlan.createSearchQuery(queryRequest);
                Assert.fail('許可されていないソート項目は例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    '許可されていないソート項目は SOQL 構築前に拒否する必要あり'
                );
            }

            Test.stopTest();
        }

    }

    private static ObjectRecordSearchContext createAccountContext() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
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