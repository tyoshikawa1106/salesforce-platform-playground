/**
 * 汎用レコード検索 Selector の describe、検索、削除 DML をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = TestDataFactory.createAccounts(4);
        accounts[0].Name = 'Selector Alpha';
        accounts[0].Industry = 'Technology';
        accounts[1].Name = 'Selector Beta';
        accounts[1].Industry = 'Finance';
        accounts[2].Name = 'Selector Delete One';
        accounts[2].Industry = 'Healthcare';
        accounts[3].Name = 'Selector Delete Two';
        accounts[3].Industry = 'Retail';
        insert accounts;
    }

    @IsTest
    static void getObjectDescribeShouldReturnAccessibleObject() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        Schema.DescribeSObjectResult objectDescribe;

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            objectDescribe = selector.getObjectDescribe('Account');
            Test.stopTest();
        }

        Assert.areEqual(
            'Account',
            objectDescribe.getName(),
            'Selector should return the requested object describe.'
        );
        Assert.isTrue(
            objectDescribe.isAccessible(),
            'Selector should only return accessible object describes.'
        );
    }

    @IsTest
    static void getNameFieldDescribeShouldReturnNameField() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        Schema.DescribeFieldResult nameFieldDescribe;

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            nameFieldDescribe = selector.getNameFieldDescribe(
                Account.SObjectType.getDescribe(
                    SObjectDescribeOptions.DEFERRED
                )
            );
            Test.stopTest();
        }

        Assert.areEqual(
            'Name',
            nameFieldDescribe.getName(),
            'Selector should return the Name-equivalent field describe.'
        );
    }

    @IsTest
    static void searchRecordsShouldRunBoundQueryPlan() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchQueryPlan.SearchQuery searchQuery = createSearchQuery(
            'Selector Alpha'
        );
        List<SObject> records;

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            records = selector.searchRecords(searchQuery);
            Test.stopTest();
        }

        Assert.areEqual(
            1,
            records.size(),
            'Selector should execute the provided query plan.'
        );
        Assert.areEqual(
            'Selector Alpha',
            (String) records[0].get('Name'),
            'Selector should return records matched by bind values.'
        );
    }

    @IsTest
    static void searchRecordsShouldThrowWhenQueryPlanIsMissing() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            try {
                selector.searchRecords(null);
                Assert.fail('Missing query plans should throw.');
            } catch (ObjectRecordSearchException error) {
                Assert.isTrue(
                    error.getMessage().contains('検索条件'),
                    'Missing query plans should explain the search condition is invalid.'
                );
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void getRecordsByIdShouldReturnMatchingRows() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = 'Selector Beta'
            LIMIT 1
        ];
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            records = selector.getRecordsById(
                'Account',
                new Set<Id>{ target.Id }
            );
            Test.stopTest();
        }

        Assert.areEqual(
            1,
            records.size(),
            'Selector should return records matching the supplied IDs.'
        );
        Assert.areEqual(
            target.Id,
            (Id) records[0].get('Id'),
            'Selector should preserve the requested record ID.'
        );
    }

    @IsTest
    static void getRecordsByIdShouldReturnEmptyListWhenIdsAreMissing() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> nullIdRecords;
        List<SObject> emptyIdRecords;

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            nullIdRecords = selector.getRecordsById('Account', null);
            emptyIdRecords = selector.getRecordsById(
                'Account',
                new Set<Id>()
            );
            Test.stopTest();
        }

        Assert.areEqual(
            0,
            nullIdRecords.size(),
            'Null IDs should not run a record lookup.'
        );
        Assert.areEqual(
            0,
            emptyIdRecords.size(),
            'Empty IDs should not run a record lookup.'
        );
    }

    @IsTest
    static void getRecordsByIdShouldThrowWhenObjectIsUnsupported() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            try {
                selector.getRecordsById(
                    'UnknownObject__c',
                    new Set<Id>{ UserInfo.getUserId() }
                );
                Assert.fail('Unsupported object API names should throw.');
            } catch (ObjectRecordSearchException error) {
                Assert.isTrue(
                    error.getMessage().contains('未対応'),
                    'Unsupported object API names should be rejected before SOQL execution.'
                );
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void deleteRecordsShouldDeleteSuppliedRows() {
        List<Account> deleteTargets = [
            SELECT Id
            FROM Account
            WHERE Name LIKE 'Selector Delete%'
            ORDER BY Name
        ];
        List<SObject> recordsToDelete = new List<SObject>();
        recordsToDelete.addAll(deleteTargets);
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<Database.DeleteResult> deleteResults;

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            deleteResults = selector.deleteRecords(recordsToDelete);
            Test.stopTest();
        }

        Assert.areEqual(
            2,
            deleteResults.size(),
            'Selector should return a DML result for each supplied row.'
        );
        Assert.isTrue(
            deleteResults[0].isSuccess(),
            'Selector should delete the first supplied row.'
        );
        Assert.isTrue(
            deleteResults[1].isSuccess(),
            'Selector should delete the second supplied row.'
        );
    }

    @IsTest
    static void getObjectDescribeShouldThrowWhenObjectIsUnknown() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(TestDataFactory.currentUser()) {
            Test.startTest();
            try {
                selector.getObjectDescribe('UnknownObject__c');
                Assert.fail('Unknown object API names should throw.');
            } catch (ObjectRecordSearchException error) {
                Assert.isTrue(
                    error.getMessage().contains('見つかりません'),
                    'Unknown object API names should explain the object was not found.'
                );
            }
            Test.stopTest();
        }
    }

    private static ObjectRecordSearchQueryPlan.SearchQuery createSearchQuery(
        String searchTerm
    ) {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchContext context = createAccountContext(service);
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = 'accounts';
        request.searchTerm = searchTerm;
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest = service.createSearchQueryRequest(
            context,
            request,
            sortSpec
        );

        return ObjectRecordSearchQueryPlan.createSearchQuery(
            searchQueryRequest
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
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            Account.Name.getDescribe(),
            objectDescribe
        )
            .withDisplayFields(ObjectRecordSearchDisplayFieldCatalog.getDisplayFields(
                'Account',
                objectDescribe
            ));
        return service.createSearchContext(
            config,
            Account.Name.getDescribe(),
            objectDescribe
        );
    }
}
