/**
 * 汎用レコード検索 Selector の動的 SOQL と bind 実行テスト
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

        Account retailTwoAccount = TestDataFactory.createAccount('Selector Retail Two', TestDataFactory.SaveMode.DO_NOT_INSERT);
        retailTwoAccount.Industry = 'Retail';
        accounts.add(retailTwoAccount);

        accounts.add(TestDataFactory.createAccount('Selector Null One', TestDataFactory.SaveMode.DO_NOT_INSERT));
        accounts.add(TestDataFactory.createAccount('Selector Null Two', TestDataFactory.SaveMode.DO_NOT_INSERT));
        insert accounts;
    }

    /**
     * 検索語を bind 値にして一致レコードを取得
     */
    @IsTest
    static void searchRecordsShouldApplyBoundNameSearch() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            ' Alpha ',
            null
        );
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.searchRecords(request);

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            records.size(),
            '部分一致 bind は対象レコードだけを返す必要あり'
        );
        Assert.areEqual(
            'Selector Alpha',
            (String) records[0].get('Name'),
            '検索語の前後空白を除いた値で検索する必要あり'
        );
    }

    /**
     * 昇順カーソル境界より後ろのレコードを取得
     */
    @IsTest
    static void searchRecordsShouldApplyAscendingCursor() {
        Account cursorAccount = [
            SELECT Id, Industry
            FROM Account
            WHERE Name = 'Selector Beta'
            LIMIT 1
        ];
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            'Selector',
            'Industry'
        );
        request.cursor = new ObjectRecordSearchSortSupport.PageCursor();
        request.cursor.sortValue = cursorAccount.Industry;
        request.cursor.recordId = cursorAccount.Id;
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.searchRecords(request);

            Test.stopTest();
        }

        Assert.areEqual(
            6,
            records.size(),
            '昇順カーソルは Finance より後ろと null 値の行を返す必要あり'
        );
        Assert.areEqual(
            'Healthcare',
            (String) records[0].get('Industry'),
            '昇順カーソル後の最初の値から返す必要あり'
        );
    }

    /**
     * 降順カーソル境界は同値 ID と null 値グループへ進行
     */
    @IsTest
    static void searchRecordsShouldApplyDescendingCursor() {
        List<Account> retailAccounts = [
            SELECT Id, Industry
            FROM Account
            WHERE Industry = 'Retail'
            ORDER BY Id
        ];
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            'Selector',
            'Industry',
            'desc'
        );
        request.cursor = new ObjectRecordSearchSortSupport.PageCursor();
        request.cursor.sortValue = retailAccounts[0].Industry;
        request.cursor.recordId = retailAccounts[0].Id;
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.searchRecords(request);

            Test.stopTest();
        }

        Assert.areEqual(
            5,
            records.size(),
            '降順カーソルは同値の次 ID、後続値、null 値を返す必要あり'
        );
        Assert.areEqual(
            retailAccounts[1].Id,
            (Id) records[0].get('Id'),
            '同値グループはカーソル ID より後ろから返す必要あり'
        );
        Assert.areEqual(
            'Healthcare',
            (String) records[1].get('Industry'),
            '降順では Retail より小さい値へ進む必要あり'
        );
        Assert.isNull(
            records[records.size() - 1].get('Industry'),
            '降順の非 null 値の後に null 値グループを返す必要あり'
        );
    }

    /**
     * null ソート値のカーソルは ID で次の行へ進行
     */
    @IsTest
    static void searchRecordsShouldAdvanceNullCursorById() {
        List<Account> nullIndustryAccounts = [
            SELECT Id
            FROM Account
            WHERE Name LIKE 'Selector Null%'
            ORDER BY Id
        ];
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchQueryRequest(
            'Selector Null',
            'Industry'
        );
        request.cursor = new ObjectRecordSearchSortSupport.PageCursor();
        request.cursor.recordId = nullIndustryAccounts[0].Id;
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.searchRecords(request);

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            records.size(),
            'null 値グループはカーソル ID より後ろの行だけを返す必要あり'
        );
        Assert.areEqual(
            nullIndustryAccounts[1].Id,
            (Id) records[0].get('Id'),
            'null 値グループ内の次 ID へ進む必要あり'
        );
    }

    /**
     * 検索条件が null の場合は例外を送出
     */
    @IsTest
    static void searchRecordsShouldRejectNullRequest() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                selector.searchRecords(null);
                Assert.fail('null の問い合わせ条件は拒否する必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('検索条件'),
                    'null の問い合わせ条件は利用者が見直す内容を返す必要あり'
                );
            }

            Test.stopTest();
        }
    }

    /**
     * 指定 ID を bind 値にして一致レコードを取得
     */
    @IsTest
    static void getRecordsByIdShouldReturnMatchingRows() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = 'Selector Delete One'
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
            'Selector は指定 ID に一致するレコードだけを返す必要あり'
        );
        Assert.areEqual(
            target.Id,
            (Id) records[0].get('Id'),
            'Selector は bind したレコード ID を保つ必要あり'
        );
    }

    /**
     * ID が null の場合は空リストを返却
     */
    @IsTest
    static void getRecordsByIdShouldReturnEmptyListWhenIdsAreNull() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById('Account', null);

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            'null ID は SOQL を実行せず空結果を返す必要あり'
        );
    }

    /**
     * ID が空の場合は空リストを返却
     */
    @IsTest
    static void getRecordsByIdShouldReturnEmptyListWhenIdsAreEmpty() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById('Account', new Set<Id>());

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            '空 ID は SOQL を実行せず空結果を返す必要あり'
        );
    }

    /**
     * 対象外オブジェクトのIDは検索結果へ含めない
     */
    @IsTest
    static void getRecordsByIdShouldExcludeIdsFromAnotherObject() {
        Account parentAccount = [
            SELECT Id
            FROM Account
            WHERE Name = 'Selector Alpha'
            LIMIT 1
        ];
        Contact contactRecord = TestDataFactory.createContact(
            parentAccount,
            'Selector Contact',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById(
                'Account',
                new Set<Id>{ contactRecord.Id }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            'Account検索ではContact IDを取得対象にしない必要あり'
        );
    }

    /**
     * 未対応オブジェクトは ID 未指定でも拒否
     */
    @IsTest
    static void getRecordsByIdShouldRejectUnsupportedObjectWithEmptyIds() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                selector.getRecordsById(
                    'UnknownObject__c',
                    new Set<Id>()
                );
                Assert.fail('未対応オブジェクトは ID 未指定でも拒否する必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('許可されていない'),
                    '未対応オブジェクトは内部契約違反として拒否する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    private static ObjectRecordSearchQueryPlan.SearchQueryRequest createSearchQueryRequest(String searchTerm, String sortBy) {
        return createSearchQueryRequest(searchTerm, sortBy, null);
    }

    private static ObjectRecordSearchQueryPlan.SearchQueryRequest createSearchQueryRequest(String searchTerm, String sortBy, String sortDirection) {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchContext context = createAccountContext(service);
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = 'accounts';
        request.searchTerm = searchTerm;
        request.sortBy = sortBy;
        request.sortDirection = sortDirection;
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchService.SearchQueryRequestResult result = service.createSearchQueryRequest(
            context,
            request,
            sortSpec
        );
        return result.searchQueryRequest;
    }

    private static ObjectRecordSearchContext createAccountContext(ObjectRecordSearchService service) {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
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
