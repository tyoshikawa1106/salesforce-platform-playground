/**
 * 汎用レコード検索 Service の判定と Wrapper 組み立てをテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchServiceTest {
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = TestDataFactory.createAccounts(2);
        accounts[0].Name = 'Service Alpha';
        accounts[0].Industry = 'Technology';
        accounts[1].Name = 'Service Beta';
        accounts[1].Industry = 'Finance';
        insert accounts;
    }

    @IsTest
    static void shouldCreateSearchResultFromQueriedRecords() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            'Service'
        );
        ObjectRecordSearchContext context = createAccountContext(service);
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = service.createSearchQueryRequest(
            context,
            request,
            sortSpec
        );
        List<SObject> records = [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Name LIKE 'Service%'
            ORDER BY Name
        ];

        ObjectRecordSearchResultWrapper result;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            result = service.createSearchResult(
                searchQueryRequest,
                records
            );
            Test.stopTest();
        }

        Assert.areEqual(
            2,
            result.records.size(),
            'Service should convert queried records into row wrappers.'
        );
        Assert.areEqual(
            'Service Alpha',
            result.records[0].name,
            'Service should keep the queried record name.'
        );
        Assert.areEqual(
            'Technology',
            result.records[0].fieldValues.get('Industry'),
            'Service should expose configured display field values.'
        );
    }

    @IsTest
    static void shouldCreatePagedSearchResultWhenMoreThanPageSizeIsFetched() {
        List<Account> accounts = TestDataFactory.createAccounts(51);
        for (Integer index = 0; index < accounts.size(); index++) {
            accounts[index].Name = 'Paged Account ' + index;
            accounts[index].Industry = 'Technology';
        }
        insert accounts;

        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            'Paged'
        );
        request.pageNumber = 0;
        ObjectRecordSearchContext context = createAccountContext(service);
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = service.createSearchQueryRequest(
            context,
            request,
            sortSpec
        );
        List<SObject> records = [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Name LIKE 'Paged Account%'
            ORDER BY Name, Id
            LIMIT 51
        ];

        ObjectRecordSearchResultWrapper result;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            result = service.createSearchResult(
                searchQueryRequest,
                records
            );
            Test.stopTest();
        }

        Assert.areEqual(
            50,
            result.records.size(),
            'Service should remove the extra fetched row from the response.'
        );
        Assert.isTrue(
            result.hasNextPage,
            'Fetching more than one page should create the next page state.'
        );
        Assert.isNotNull(
            result.nextPageToken,
            'Next page state should include a cursor token.'
        );
        Assert.areEqual(
            1,
            result.pageNumber,
            'Invalid page numbers should be normalized to the first page.'
        );
    }

    @IsTest
    static void shouldCreateDeleteResultFromDmlResults() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = 'Service Beta'
            LIMIT 1
        ];
        List<Id> recordIds = new List<Id>{ target.Id };
        List<Database.DeleteResult> deleteResults = Database.delete(
            new List<Account>{ target },
            false,
            AccessLevel.USER_MODE
        );
        ObjectRecordSearchService service = new ObjectRecordSearchService();

        ObjectRecordSearchDeleteWrapper result;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            result = service.createDeleteResult(recordIds, deleteResults);
            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.requestedCount,
            'Delete result should keep the requested count.'
        );
        Assert.areEqual(
            1,
            result.deletedCount,
            'Delete result should count successful DML rows.'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            'Successful delete results should not expose errors.'
        );
    }

    @IsTest
    static void shouldThrowWhenMetricKeyIsUnsupported() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            try {
                service.requireDefinition('unknown');
                Assert.fail('Unsupported metric keys should throw.');
            } catch (ObjectRecordSearchException error) {
                Assert.isTrue(
                    error.getMessage().contains('未対応'),
                    'Unsupported metric keys should explain the object is unsupported.'
                );
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void shouldReturnFalseWhenDeleteRequestIsEmpty() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchConfigWrapper config = createAccountContext(
                service
            )
            .config;

        Boolean canDelete;
        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            canDelete = service.canDeleteRecords(config, new List<Id>());
            Test.stopTest();
        }

        Assert.isFalse(
            canDelete,
            'Empty delete requests should not require DML.'
        );
    }

    private static ObjectRecordSearchContext createAccountContext(
        ObjectRecordSearchService service
    ) {
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Schema.DescribeFieldResult nameFieldDescribe = Account.Name.getDescribe();
        List<ObjectRecordSearchFieldWrapper> displayFields = new List<ObjectRecordSearchFieldWrapper>{
            new ObjectRecordSearchFieldWrapper('Industry', 'Industry', 'text')
        };

        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        )
            .withDisplayFields(displayFields);
        return service.createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
        );
    }

    private static ObjectRecordSearchRequestWrapper createSearchRequest(
        String metricKey,
        String searchTerm
    ) {
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }
}
