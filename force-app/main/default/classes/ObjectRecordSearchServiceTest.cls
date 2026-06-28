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
        ObjectRecordSearchConfigWrapper config = createAccountConfig(service);
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
            config,
            request
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = service.createSearchQueryRequest(
            config,
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
        System.runAs(getCurrentUser()) {
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
        System.runAs(getCurrentUser()) {
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

        System.runAs(getCurrentUser()) {
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
        ObjectRecordSearchConfigWrapper config = createAccountConfig(service);

        Boolean canDelete;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            canDelete = service.canDeleteRecords(config, new List<Id>());
            Test.stopTest();
        }

        Assert.isFalse(
            canDelete,
            'Empty delete requests should not require DML.'
        );
    }

    private static ObjectRecordSearchConfigWrapper createAccountConfig(
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

        return service.createObjectConfig(
            definition,
            nameFieldDescribe,
            service.createAccess(objectDescribe, displayFields)
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
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
