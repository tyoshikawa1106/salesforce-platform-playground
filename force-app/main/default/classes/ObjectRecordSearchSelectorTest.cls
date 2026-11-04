/**
 * 汎用レコード検索 Selector の動的 SOQL と bind 実行テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {

    private static ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
    private static ObjectRecordSearchService service = new ObjectRecordSearchService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();

        Account alphaAccount = new Account(Name = 'Selector Alpha');
        alphaAccount.Industry = 'Technology';
        accounts.add(alphaAccount);

        Account betaAccount = new Account(Name = 'Selector Beta');
        betaAccount.Industry = 'Finance';
        accounts.add(betaAccount);

        Account deleteOneAccount = new Account(Name = 'Selector Delete One');
        deleteOneAccount.Industry = 'Healthcare';
        accounts.add(deleteOneAccount);

        Account deleteTwoAccount = new Account(Name = 'Selector Delete Two');
        deleteTwoAccount.Industry = 'Retail';
        accounts.add(deleteTwoAccount);

        Account retailTwoAccount = new Account(Name = 'Selector Retail Two');
        retailTwoAccount.Industry = 'Retail';
        accounts.add(retailTwoAccount);

        accounts.add(new Account(Name = 'Selector Null One'));
        accounts.add(new Account(Name = 'Selector Null Two'));
        insert accounts;
    }

    /**
     * 検索語ごとの確認に共通する標準検索要求を生成
     * @param searchTerm 各テストが確認する検索語
     * @return 対象・ソート条件を解決済みの要求
     */
    private static ObjectRecordSearchQueryPlan.SearchQueryRequest createSearchRequest(String searchTerm) {
        ObjectRecordSearchRequestWrapper input = new ObjectRecordSearchRequestWrapper();
        input.metricKey = 'accounts';
        input.searchTerm = searchTerm;
        ObjectRecordSearchService.SearchContextResult context = service.resolveSearchContext(input.metricKey);
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(context.context, input);
        ObjectRecordSearchService.SearchQueryRequestResult prepared = service.createSearchQueryRequest(context.context, input, sortSpec);
        return prepared.searchQueryRequest;
    }

    /** 名称条件をbindして標準カーソルから取得 */
    @IsTest
    static void shouldUseBoundSearchWithStandardCursor() {

        System.runAs(testUser) {
            Test.startTest();
            ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchRequest(' Selector Alpha ');
            Database.PaginationCursor cursor = selector.createPaginationCursor(request);
            Assert.isNull(request.paginationCursor, 'カーソル作成は入力を書き換えない必要あり');
            request.paginationCursor = cursor;
            Database.PaginationCursor reused = selector.createPaginationCursor(request);
            Assert.areEqual(cursor, reused, '継続取得では同じ結果集合を再利用する必要あり');
            Database.CursorFetchResult fetched = selector.searchRecords(request);
            ObjectRecordSearchResultWrapper page = service.createSearchResult(request, fetched);
            Assert.areEqual(cursor, request.paginationCursor, 'ページ取得は入力のカーソルを置換しない必要あり');
            Test.stopTest();
            Assert.areEqual(1, page.records.size(), '名称検索が標準カーソルにも適用される必要あり');
            Assert.areEqual('Selector Alpha', page.records[0].name, '前後空白を正規化する必要あり');
            Assert.isFalse(page.hasNextPage, '最終ページの次へを無効化する必要あり');
        }
    }

    /** 対象なしの検索結果を空ページとして返却 */
    @IsTest
    static void shouldReturnEmptyPage() {

        System.runAs(testUser) {
            Test.startTest();
            ObjectRecordSearchQueryPlan.SearchQueryRequest request = createSearchRequest('No matching records');
            request.paginationCursor = selector.createPaginationCursor(request);
            Database.CursorFetchResult fetched = selector.searchRecords(request);
            ObjectRecordSearchResultWrapper page = service.createSearchResult(request, fetched);
            Test.stopTest();
            Assert.areEqual(0, page.records.size(), '対象なしは空一覧となる必要あり');
            Assert.isFalse(page.hasNextPage, '対象なしで次ページを作らない必要あり');
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
        Contact contactRecord = new Contact(AccountId = parentAccount.Id, LastName = 'Selector Contact');
        insert contactRecord;
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

    /** ページ取得のカーソル不足を暗黙の初回取得にしない */
    @IsTest
    static void rejectsMissingFetchCursor() {

        System.runAs(testUser) {
            Test.startTest();
            ObjectRecordSearchRequestWrapper input = new ObjectRecordSearchRequestWrapper();
            input.metricKey = 'accounts';
            ObjectRecordSearchService.SearchContextResult context = service.resolveSearchContext(input.metricKey);
            ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(context.context, input);
            ObjectRecordSearchService.SearchQueryRequestResult prepared = service.createSearchQueryRequest(context.context, input, sortSpec);
            try {
                selector.searchRecords(prepared.searchQueryRequest);
                Assert.fail('カーソルなしの取得要求は拒否する必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(e.getMessage().contains('カーソル'), '不足している取得条件を示す必要あり');
            }
            Test.stopTest();
        }
    }

}
