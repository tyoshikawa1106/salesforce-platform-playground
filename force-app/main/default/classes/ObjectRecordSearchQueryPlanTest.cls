/**
 * 汎用レコード検索の SOQL 組み立てをテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchQueryPlanTest {
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
        cursor.recordId = TestDataFactory.insertAccount('Query Cursor').Id;

        ObjectRecordSearchQueryPlan.SearchQueryRequest queryRequest = new ObjectRecordSearchQueryPlan.SearchQueryRequest();
        queryRequest.context = context;
        queryRequest.searchRequest = request;
        queryRequest.sortSpec = sortSpec;
        queryRequest.cursor = cursor;
        queryRequest.fetchSize = 51;

        ObjectRecordSearchQueryPlan.SearchQuery query;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            query = ObjectRecordSearchQueryPlan.createSearchQuery(queryRequest);
            Test.stopTest();
        }

        Assert.isTrue(
            query.soql.contains('Name LIKE :nameSearchTerm'),
            'Search queries should include a bound Name search condition.'
        );
        Assert.isTrue(
            query.soql.contains('Industry < :cursorSortValue'),
            'Descending cursor queries should compare with the less-than operator.'
        );
        Assert.isTrue(
            query.soql.contains('ORDER BY Industry DESC NULLS LAST, Id ASC LIMIT 51'),
            'Queries should keep the requested sort and fetch size.'
        );
        Assert.areEqual(
            '%Query%',
            query.bindValues.get('nameSearchTerm'),
            'Search term should be trimmed and wrapped for LIKE.'
        );
        Assert.areEqual(
            cursor.sortValue,
            query.bindValues.get('cursorSortValue'),
            'Cursor sort value should be exposed as a bind value.'
        );
        Assert.areEqual(
            cursor.recordId,
            query.bindValues.get('cursorRecordId'),
            'Cursor record Id should be exposed as a bind value.'
        );
    }

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
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            query = ObjectRecordSearchQueryPlan.createSearchQuery(queryRequest);
            Test.stopTest();
        }

        Assert.isFalse(
            query.soql.contains(' WHERE '),
            'Blank searches without cursors should not add a WHERE clause.'
        );
        Assert.areEqual(
            0,
            query.bindValues.size(),
            'Blank searches without cursors should not add bind values.'
        );
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
