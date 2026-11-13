/**
 * 汎用レコード検索 Selector の動的 SOQL と bind 実行テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {

    private static ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
    private static ObjectRecordSearchService service = new ObjectRecordSearchService();

    private static User testUser = new User(Id = UserInfo.getUserId());

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
            insert new List<Account>{new Account(Name = 'Selector Alpha'), new Account(Name = 'Selector Beta')};
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
            insert new Account(Name = '検索に一致しない取引先');
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
        Account target = new Account(Name = '取得対象');
        List<SObject> records;

        System.runAs(testUser) {
            insert new List<Account>{ target, new Account(Name = '取得対象外') };
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
        Id nonAccountId = UserInfo.getUserId();
        List<SObject> records;

        System.runAs(testUser) {
            insert new Account(Name = '対象外IDでは取得しない取引先');
            Test.startTest();

            records = selector.getRecordsById(
                'Account',
                new Set<Id>{ nonAccountId }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            'Account検索ではUser IDを取得対象にしない必要あり'
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

    /** 選択リストの設定順と同値内のID順を取得 */
    @IsTest
    static void sortsPicklistValuesInBothDirections() {

        System.runAs(testUser) {
            insert new List<Opportunity>{
                new Opportunity(Name = '順序A', StageName = 'Prospecting', CloseDate = Date.today()),
                new Opportunity(Name = '順序B', StageName = 'Needs Analysis', CloseDate = Date.today()),
                new Opportunity(Name = '順序C', StageName = 'Prospecting', CloseDate = Date.today())
            };
            List<Opportunity> ascending = [SELECT Id FROM Opportunity ORDER BY StageName ASC NULLS LAST, Id ASC];
            List<Opportunity> descending = [SELECT Id FROM Opportunity ORDER BY StageName DESC NULLS LAST, Id ASC];
            Test.startTest();
            Assert.areEqual(recordIds(ascending), readSortedIds('opportunities', 'StageName', 'asc'), '選択値の昇順を維持');
            Assert.areEqual(recordIds(descending), readSortedIds('opportunities', 'StageName', 'desc'), '選択値の降順を維持');
            Test.stopTest();
        }
    }

    /** Booleanの両値を指定方向で取得 */
    @IsTest
    static void sortsBooleanValuesInBothDirections() {

        System.runAs(testUser) {
            insert new List<Product2>{
                new Product2(Name = '有効A', IsActive = true),
                new Product2(Name = '無効', IsActive = false),
                new Product2(Name = '有効B', IsActive = true)
            };
            List<Product2> ascending = [SELECT Id FROM Product2 ORDER BY IsActive ASC NULLS LAST, Id ASC];
            List<Product2> descending = [SELECT Id FROM Product2 ORDER BY IsActive DESC NULLS LAST, Id ASC];
            Test.startTest();
            Assert.areEqual(recordIds(ascending), readSortedIds('products', 'IsActive', 'asc'), 'Booleanの昇順を維持');
            Assert.areEqual(recordIds(descending), readSortedIds('products', 'IsActive', 'desc'), 'Booleanの降順を維持');
            Test.stopTest();
        }
    }

    /** nullの選択値を末尾に置き同値内のID順を維持 */
    @IsTest
    static void sortsNullablePicklists() {

        System.runAs(testUser) {
            insert new List<Account>{
                new Account(Name = '設定済みA', Industry = 'Retail'),
                new Account(Name = '設定済みB', Industry = 'Retail'),
                new Account(Name = '未設定A'),
                new Account(Name = '未設定B')
            };
            List<Account> expected = [SELECT Id FROM Account ORDER BY Industry ASC NULLS LAST, Id ASC];
            Test.startTest();
            Assert.areEqual(recordIds(expected), readSortedIds('accounts', 'Industry', 'asc'), 'nullを末尾へ配置');
            Test.stopTest();
        }
    }

    private static List<Id> readSortedIds(String key, String field, String direction) {
        ObjectRecordSearchRequestWrapper input = new ObjectRecordSearchRequestWrapper();
        input.metricKey = key;
        input.sortBy = field;
        input.sortDirection = direction;
        ObjectRecordSearchContext context = service.resolveSearchContext(key).context;
        ObjectRecordSearchQueryPlan.SearchQueryRequest request = service.createSearchQueryRequest(
            context, input, service.createSortSpec(context, input)
        ).searchQueryRequest;
        request.paginationCursor = selector.createPaginationCursor(request);
        Database.CursorFetchResult fetched = selector.searchRecords(request);
        return recordIds(fetched.getRecords());
    }

    private static List<Id> recordIds(List<SObject> records) {
        List<Id> ids = new List<Id>();
        for (SObject record : records) {
            ids.add(record.Id);
        }
        return ids;
    }
}
