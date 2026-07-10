/**
 * 汎用レコード検索 Selector の describe、検索、削除 DML テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {

    private static User testUser = TestDataFactory.currentUser();

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

        System.runAs(testUser) {
            Test.startTest();

            objectDescribe = selector.getObjectDescribe('Account');

            Test.stopTest();
        }

        Assert.areEqual(
            'Account',
            objectDescribe.getName(),
            'Selector は指定されたオブジェクト describe を返す必要あり'
        );
        Assert.isTrue(
            objectDescribe.isAccessible(),
            'Selector はアクセス可能なオブジェクト describe だけを返す必要あり'
        );
    }

    @IsTest
    static void getNameFieldDescribeShouldReturnNameField() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        Schema.DescribeFieldResult nameFieldDescribe;

        System.runAs(testUser) {
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
            'Selector は Name 相当項目の describe を返す必要あり'
        );
    }

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

    @IsTest
    static void searchRecordsShouldThrowWhenQueryPlanIsMissing() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                selector.searchRecords(null);
                Assert.fail('クエリプラン未指定は例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    'クエリプラン未指定は検索条件の不正を説明する必要あり'
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

    @IsTest
    static void getRecordsByIdShouldThrowWhenObjectIsUnsupported() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                selector.getRecordsById(
                    'UnknownObject__c',
                    new Set<Id>{ UserInfo.getUserId() }
                );
                Assert.fail('未対応のオブジェクト API 名は例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('表示できません'),
                    '未対応のオブジェクト API 名は SOQL 実行前に拒否する必要あり'
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

        System.runAs(testUser) {
            Test.startTest();

            deleteResults = selector.deleteRecords(recordsToDelete);

            Test.stopTest();
        }

        Assert.areEqual(
            2,
            deleteResults.size(),
            'Selector は指定行ごとに DML 結果を返す必要あり'
        );
        Assert.isTrue(
            deleteResults[0].isSuccess(),
            'Selector は指定された 1 件目の行を削除する必要あり'
        );
        Assert.isTrue(
            deleteResults[1].isSuccess(),
            'Selector は指定された 2 件目の行を削除する必要あり'
        );
    }

    @IsTest
    static void getObjectDescribeShouldThrowWhenObjectIsUnknown() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                selector.getObjectDescribe('UnknownObject__c');
                Assert.fail('未知のオブジェクト API 名は例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('利用できません'),
                    '未知のオブジェクト API 名はオブジェクト未検出を説明する必要あり'
                );
            }

            Test.stopTest();
        }
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
