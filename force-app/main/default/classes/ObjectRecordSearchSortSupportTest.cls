/**
 * 汎用レコード検索のソート・ページング補助をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchSortSupportTest {
    private static User testUser = TestDataFactory.currentUser();

    @TestSetup
    static void setupData() {
        insert new Account(
            Name = 'Cursor Account',
            Industry = 'Technology'
        );
    }

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
            'Missing sort requests should use the name field.'
        );
        Assert.areEqual(
            'asc',
            sortSpec.direction,
            'Missing sort directions should use ascending order.'
        );
    }

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
            'Allowed sort fields should be preserved.'
        );
        Assert.areEqual(
            'desc',
            sortSpec.direction,
            'Descending sort requests should be preserved.'
        );
    }

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
            'Non-sortable display fields should fall back to the name field.'
        );
    }

    @IsTest
    static void shouldCreateAndParseNextPageToken() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Industry';
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            request
        );

        ObjectRecordSearchSortSupport.PageCursor cursor;
        System.runAs(testUser) {
            Test.startTest();
            cursor = createParsedCursor(
                context.config,
                sortSpec
            );
            Test.stopTest();
        }

        Assert.areEqual(
            'Technology',
            cursor.sortValue,
            'Parsed cursor should keep the row sort value.'
        );
        Assert.areEqual(
            getTestAccountId(),
            cursor.recordId,
            'Parsed cursor should keep the last row Id.'
        );
    }

    @IsTest
    static void shouldCreateAndParseNameSortPageToken() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );

        ObjectRecordSearchSortSupport.PageCursor cursor;
        System.runAs(testUser) {
            Test.startTest();
            cursor = createParsedCursor(
                context.config,
                sortSpec
            );
            Test.stopTest();
        }

        Assert.areEqual(
            'Cursor Account',
            cursor.sortValue,
            'Name sort tokens should use the row name as the cursor value.'
        );
    }

    @IsTest
    static void shouldReturnNullTokenWhenRowsAreMissing() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken;

        System.runAs(testUser) {
            Test.startTest();
            pageToken = ObjectRecordSearchSortSupport.createNextPageToken(
                new List<ObjectRecordSearchRowWrapper>(),
                sortSpec
            );
            Test.stopTest();
        }

        Assert.isNull(
            pageToken,
            'Empty row lists should not create a page token.'
        );
    }

    @IsTest
    static void shouldParseLegacyNamePageToken() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'recordId' => String.valueOf(getTestAccountId()),
                'name' => 'Cursor Account'
            }
        );

        ObjectRecordSearchSortSupport.PageCursor cursor;
        System.runAs(testUser) {
            Test.startTest();
            cursor = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
                sortSpec
            );
            Test.stopTest();
        }

        Assert.areEqual(
            'Cursor Account',
            cursor.sortValue,
            'Legacy name tokens should keep reading the name cursor value.'
        );
    }

    @IsTest
    static void shouldCreateCursorWhereClauseForAscendingSort() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.sortValue = 'Cursor Account';
        cursor.recordId = getTestAccountId();

        String whereClause;
        System.runAs(testUser) {
            Test.startTest();
            whereClause = ObjectRecordSearchSortSupport.createCursorWhereClause(
                sortSpec,
                cursor
            );
            Test.stopTest();
        }

        Assert.isTrue(
            whereClause.contains('Name > :cursorSortValue'),
            'Ascending cursor clauses should use the greater-than operator.'
        );
        Assert.isTrue(
            whereClause.contains('Id > :cursorRecordId'),
            'Cursor clauses should use Id as the deterministic tie breaker.'
        );
    }

    @IsTest
    static void shouldCreateCursorWhereClauseForNullSortValue() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.recordId = getTestAccountId();

        String whereClause;
        System.runAs(testUser) {
            Test.startTest();
            whereClause = ObjectRecordSearchSortSupport.createCursorWhereClause(
                sortSpec,
                cursor
            );
            Test.stopTest();
        }

        Assert.isTrue(
            whereClause.contains('Name = NULL'),
            'Null cursor values should keep the query inside the null sort group.'
        );
    }

    @IsTest
    static void shouldThrowWhenPageTokenDoesNotMatchSortField() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'fieldApiName' => 'Industry',
                'recordId' => String.valueOf(getTestAccountId()),
                'sortValue' => 'Technology'
            }
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                ObjectRecordSearchSortSupport.parsePageToken(
                    pageToken,
                    sortSpec
                );
                Assert.fail('Mismatched page tokens should throw.');
            } catch (ObjectRecordSearchException error) {
                Assert.isTrue(
                    error.getMessage().contains('ページ指定'),
                    'Mismatched page tokens should explain the page token cannot be read.'
                );
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void shouldThrowDomainExceptionWhenPageTokenIsMalformed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                ObjectRecordSearchSortSupport.parsePageToken(
                    '{malformed',
                    sortSpec
                );
                Assert.fail('Malformed page tokens should throw.');
            } catch (ObjectRecordSearchException error) {
                Assert.isTrue(
                    error.getMessage().contains('ページ指定'),
                    'Malformed page tokens should be normalized into the search exception.'
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
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
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

    private static Id getTestAccountId() {
        return [
            SELECT Id
            FROM Account
            WHERE Name = 'Cursor Account'
            LIMIT 1
        ].Id;
    }

    private static ObjectRecordSearchSortSupport.PageCursor createParsedCursor(
        ObjectRecordSearchConfigWrapper config,
        ObjectRecordSearchSortSupport.SortSpec sortSpec
    ) {
        Account accountRecord = new Account(
            Id = getTestAccountId(),
            Name = 'Cursor Account',
            Industry = 'Technology'
        );
        List<ObjectRecordSearchRowWrapper> rows = new List<ObjectRecordSearchRowWrapper>{
            new ObjectRecordSearchRowWrapper(
                accountRecord,
                config.nameFieldApiName,
                config.displayFields
            )
        };
        String pageToken = ObjectRecordSearchSortSupport.createNextPageToken(
            rows,
            sortSpec
        );
        return ObjectRecordSearchSortSupport.parsePageToken(
            pageToken,
            sortSpec
        );
    }
}
