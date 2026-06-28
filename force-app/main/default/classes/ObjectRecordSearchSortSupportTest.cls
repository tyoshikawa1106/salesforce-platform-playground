/**
 * 汎用レコード検索のソート・ページング補助をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchSortSupportTest {
    @TestSetup
    static void setupData() {
        insert new Account(
            Name = 'Cursor Account',
            Industry = 'Technology'
        );
    }

    @IsTest
    static void shouldCreateDefaultSortSpecWhenSortRequestIsMissing() {
        ObjectRecordSearchConfigWrapper config = createAccountConfig();

        ObjectRecordSearchSortSupport.SortSpec sortSpec;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                config,
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
        ObjectRecordSearchConfigWrapper config = createAccountConfig();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Industry';
        request.sortDirection = 'desc';

        ObjectRecordSearchSortSupport.SortSpec sortSpec;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                config,
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
    static void shouldCreateAndParseNextPageToken() {
        ObjectRecordSearchConfigWrapper config = createAccountConfig();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Industry';
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            config,
            request
        );
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

        String pageToken;
        ObjectRecordSearchSortSupport.PageCursor cursor;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            pageToken = ObjectRecordSearchSortSupport.createNextPageToken(
                rows,
                sortSpec
            );
            cursor = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
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
            accountRecord.Id,
            cursor.recordId,
            'Parsed cursor should keep the last row Id.'
        );
    }

    @IsTest
    static void shouldCreateCursorWhereClauseForAscendingSort() {
        ObjectRecordSearchConfigWrapper config = createAccountConfig();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            config,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.sortValue = 'Cursor Account';
        cursor.recordId = getTestAccountId();

        String whereClause;
        System.runAs(getCurrentUser()) {
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
        ObjectRecordSearchConfigWrapper config = createAccountConfig();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            config,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.recordId = getTestAccountId();

        String whereClause;
        System.runAs(getCurrentUser()) {
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
        ObjectRecordSearchConfigWrapper config = createAccountConfig();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            config,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'fieldApiName' => 'Industry',
                'recordId' => String.valueOf(getTestAccountId()),
                'sortValue' => 'Technology'
            }
        );

        System.runAs(getCurrentUser()) {
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

    private static ObjectRecordSearchConfigWrapper createAccountConfig() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        return service.createObjectConfig(
            definition,
            objectDescribe.fields.getMap().get('Name').getDescribe(),
            service.createAccess(
                objectDescribe,
                new List<ObjectRecordSearchFieldWrapper>{
                    new ObjectRecordSearchFieldWrapper(
                        'Industry',
                        'Industry',
                        'text'
                    )
                }
            )
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

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
