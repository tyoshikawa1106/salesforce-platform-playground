/**
 * 汎用レコード検索 Selector の SOQL 実行テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();

        Account alphaAccount = TestDataFactory.createAccount('Selector Alpha', TestDataFactory.SaveMode.DO_NOT_INSERT);
        alphaAccount.Industry = 'Technology';
        accounts.add(alphaAccount);

        Account betaAccount = TestDataFactory.createAccount('Selector Beta', TestDataFactory.SaveMode.DO_NOT_INSERT);
        betaAccount.Industry = 'Finance';
        accounts.add(betaAccount);

        Account deleteOneAccount = TestDataFactory.createAccount('Selector Delete One', TestDataFactory.SaveMode.DO_NOT_INSERT);
        deleteOneAccount.Industry = 'Healthcare';
        accounts.add(deleteOneAccount);

        Account deleteTwoAccount = TestDataFactory.createAccount('Selector Delete Two', TestDataFactory.SaveMode.DO_NOT_INSERT);
        deleteTwoAccount.Industry = 'Retail';
        accounts.add(deleteTwoAccount);
        insert accounts;
    }

    /**
     * 組み立て済み検索条件でレコードを取得
     */
    @IsTest
    static void searchRecordsShouldRunBoundQueryPlan() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchQueryPlan.SearchQuery searchQuery = createSearchQuery(
            'Selector Alpha'
        );
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.searchRecords(searchQuery);

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            records.size(),
            'Selector は指定されたクエリプランを実行する必要あり'
        );
        Assert.areEqual(
            'Selector Alpha',
            (String) records[0].get('Name'),
            'Selector はバインド値に一致するレコードを返す必要あり'
        );
    }

    /**
     * 指定 ID に一致するレコードを取得
     */
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

        System.runAs(testUser) {
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
            'Selector は指定 ID に一致するレコードを返す必要あり'
        );
        Assert.areEqual(
            target.Id,
            (Id) records[0].get('Id'),
            'Selector は指定されたレコード ID を保つ必要あり'
        );
    }

    /**
     * ID 未指定時は空リストを返却
     */
    @IsTest
    static void getRecordsByIdShouldReturnEmptyListWhenIdsAreMissing() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> nullIdRecords;
        List<SObject> emptyIdRecords;

        System.runAs(testUser) {
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
            'null ID はレコード検索を実行しない必要あり'
        );
        Assert.areEqual(
            0,
            emptyIdRecords.size(),
            '空 ID はレコード検索を実行しない必要あり'
        );
    }

    private static ObjectRecordSearchQueryPlan.SearchQuery createSearchQuery(String searchTerm) {
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

    private static ObjectRecordSearchContext createAccountContext(ObjectRecordSearchService service) {
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
