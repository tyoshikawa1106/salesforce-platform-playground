/**
 * 汎用レコード検索 Service の判定と Wrapper 組み立てテスト
 */
@IsTest
private with sharing class ObjectRecordSearchServiceTest {

    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();

        Account alphaAccount = TestDataFactory.createAccount('Service Alpha', TestDataFactory.SaveMode.DO_NOT_INSERT);
        alphaAccount.Industry = 'Technology';
        accounts.add(alphaAccount);

        Account betaAccount = TestDataFactory.createAccount('Service Beta', TestDataFactory.SaveMode.DO_NOT_INSERT);
        betaAccount.Industry = 'Finance';
        accounts.add(betaAccount);
        insert accounts;
    }

    /**
     * 取得レコードから検索結果を作成
     */
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

        System.runAs(testUser) {
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
            'Service は取得レコードを row wrapper に変換する必要あり'
        );
        Assert.areEqual(
            'Service Alpha',
            result.records[0].name,
            'Service は取得レコード名を保つ必要あり'
        );
        Assert.areEqual(
            'Technology',
            result.records[0].fieldValues.get('Industry'),
            'Service は設定済み表示項目値を公開する必要あり'
        );
    }

    /**
     * ページサイズ超過時に次ページ情報を作成
     */
    @IsTest
    static void shouldCreatePagedSearchResultWhenMoreThanPageSizeIsFetched() {
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < 51; index++) {
            Account accountRecord = TestDataFactory.createAccount('Paged Account ' + index, TestDataFactory.SaveMode.DO_NOT_INSERT);
            accountRecord.Industry = 'Technology';
            accounts.add(accountRecord);
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

        System.runAs(testUser) {
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
            'Service は余分に取得した行をレスポンスから除く必要あり'
        );
        Assert.isTrue(
            result.hasNextPage,
            '複数ページ分を取得した場合は次ページ状態を作成する必要あり'
        );
        Assert.isNotNull(
            result.nextPageToken,
            '次ページ状態はカーソルトークンを含む必要あり'
        );
        Assert.areEqual(
            1,
            result.pageNumber,
            '不正なページ番号は 1 ページ目へ補正する必要あり'
        );
    }

    /**
     * DML 結果から削除結果を作成
     */
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

        System.runAs(testUser) {
            Test.startTest();

            result = service.createDeleteResult(recordIds, deleteResults);

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.requestedCount,
            '削除結果は依頼件数を保つ必要あり'
        );
        Assert.areEqual(
            1,
            result.deletedCount,
            '削除結果は成功した DML 行数を数える必要あり'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            '成功した削除結果はエラーを公開しない必要あり'
        );
    }

    /**
     * 未対応メトリクスキーは例外を送出
     */
    @IsTest
    static void shouldThrowWhenMetricKeyIsUnsupported() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();

        System.runAs(testUser) {
            Test.startTest();

            try {
                service.requireDefinition('unknown');
                Assert.fail('未対応のメトリクスキーは例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('表示できません'),
                    '未対応のメトリクスキーはオブジェクト未対応を説明する必要あり'
                );
            }

            Test.stopTest();
        }

    }

    /**
     * 削除リクエストが空の場合は削除不可を返却
     */
    @IsTest
    static void shouldReturnFalseWhenDeleteRequestIsEmpty() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchConfigWrapper config = createAccountContext(
                service
            )
            .config;
        Boolean canDelete;

        System.runAs(testUser) {
            Test.startTest();

            canDelete = service.canDeleteRecords(config, new List<Id>());

            Test.stopTest();
        }

        Assert.isFalse(
            canDelete,
            '空の削除リクエストは DML を不要にする必要あり'
        );
    }

    /**
     * 削除設定がない場合は削除不可を返却
     */
    @IsTest
    static void shouldReturnFalseWhenDeleteConfigIsMissing() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        Boolean canDelete;

        System.runAs(testUser) {
            Test.startTest();

            canDelete = service.canDeleteRecords(
                null,
                new List<Id>{ UserInfo.getUserId() }
            );

            Test.stopTest();
        }

        Assert.isFalse(
            canDelete,
            'config 未指定では削除 DML を許可しない必要あり'
        );
    }

    private static ObjectRecordSearchContext createAccountContext(ObjectRecordSearchService service) {
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

    private static ObjectRecordSearchRequestWrapper createSearchRequest(String metricKey, String searchTerm) {
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }
}