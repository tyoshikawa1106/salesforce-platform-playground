/**
 * 汎用レコード検索のソート・ページング補助テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSortSupportTest {

    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupData() {
        insert new Account(
            Name = 'Cursor Account',
            Industry = 'Technology'
        );
    }

    /**
     * ソート指定なしの場合は既定ソート条件を作成
     */
    @IsTest
    static void shouldCreateDefaultSortSpecWhenSortRequestIsMissing() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec;

        System.runAs(testUser) {
            Test.startTest();

            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                context,
                new ObjectRecordSearchRequestWrapper()
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Name',
            sortSpec.fieldApiName,
            'ソート指定がない場合は名前項目を使う必要あり'
        );
        Assert.areEqual(
            'asc',
            sortSpec.direction,
            'ソート方向がない場合は昇順を使う必要あり'
        );
    }

    /**
     * 許可項目のソート指定からソート条件を作成
     */
    @IsTest
    static void shouldCreateRequestedSortSpecWhenFieldIsAllowed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Industry';
        request.sortDirection = 'desc';
        ObjectRecordSearchSortSupport.SortSpec sortSpec;

        System.runAs(testUser) {
            Test.startTest();

            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                context,
                request
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Industry',
            sortSpec.fieldApiName,
            '許可されたソート項目は維持する必要あり'
        );
        Assert.areEqual(
            'desc',
            sortSpec.direction,
            '降順指定は維持する必要あり'
        );
    }

    /**
     * ソート不可項目は Name ソートへ切り替え
     */
    @IsTest
    static void shouldFallbackToNameWhenSortFieldIsNotSortable() {
        ObjectRecordSearchContext context = createAccountContextWithDescription();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Description';
        ObjectRecordSearchSortSupport.SortSpec sortSpec;

        System.runAs(testUser) {
            Test.startTest();

            sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
                context,
                request
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Name',
            sortSpec.fieldApiName,
            'ソート不可の表示項目は名前項目へフォールバックする必要あり'
        );
    }

    /**
     * 次ページトークンを作成して復元
     */
    @IsTest
    static void shouldCreateAndParseNextPageToken() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.sortBy = 'Industry';
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            request
        );
        ObjectRecordSearchSortSupport.PageCursor cursor;

        System.runAs(testUser) {
            Test.startTest();

            cursor = createParsedCursor(
                context.config,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Technology',
            cursor.sortValue,
            '解析後カーソルは行のソート値を保つ必要あり'
        );
        Assert.areEqual(
            getTestAccountId(),
            cursor.recordId,
            '解析後カーソルは最後の行 ID を保つ必要あり'
        );
    }

    /**
     * Name ソート用ページトークンを作成して復元
     */
    @IsTest
    static void shouldCreateAndParseNameSortPageToken() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor;

        System.runAs(testUser) {
            Test.startTest();

            cursor = createParsedCursor(
                context.config,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Cursor Account',
            cursor.sortValue,
            '名前ソートのトークンは行名をカーソル値にする必要あり'
        );
    }

    /**
     * 行がない場合はページトークンを返さない
     */
    @IsTest
    static void shouldReturnNullTokenWhenRowsAreMissing() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken;

        System.runAs(testUser) {
            Test.startTest();

            pageToken = ObjectRecordSearchSortSupport.createNextPageToken(
                new List<ObjectRecordSearchRowWrapper>(),
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isNull(
            pageToken,
            '空の行リストはページトークンを作成しない必要あり'
        );
    }

    /**
     * 旧形式の Name ページトークンを復元
     */
    @IsTest
    static void shouldParseLegacyNamePageToken() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        Id testAccountId = getTestAccountId();
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'recordId' => String.valueOf(testAccountId),
                'name' => 'Cursor Account'
            }
        );
        ObjectRecordSearchSortSupport.PageCursor cursor;

        System.runAs(testUser) {
            Test.startTest();

            cursor = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Cursor Account',
            cursor.sortValue,
            '旧形式の名前トークンは名前カーソル値を読み取る必要あり'
        );
    }

    /**
     * 昇順ソート用のカーソル WHERE 条件を作成
     */
    @IsTest
    static void shouldCreateCursorWhereClauseForAscendingSort() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.sortValue = 'Cursor Account';
        cursor.recordId = getTestAccountId();
        String whereClause;

        System.runAs(testUser) {
            Test.startTest();

            whereClause = ObjectRecordSearchSortSupport.createCursorWhereClause(
                sortSpec,
                cursor
            );

            Test.stopTest();
        }

        Assert.isTrue(
            whereClause.contains('Name > :cursorSortValue'),
            '昇順カーソル条件は大なり演算子を使う必要あり'
        );
        Assert.isTrue(
            whereClause.contains('Id > :cursorRecordId'),
            'カーソル条件は決定的な同値解消に Id を使う必要あり'
        );
    }

    /**
     * null ソート値用のカーソル WHERE 条件を作成
     */
    @IsTest
    static void shouldCreateCursorWhereClauseForNullSortValue() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchSortSupport.PageCursor cursor = new ObjectRecordSearchSortSupport.PageCursor();
        cursor.recordId = getTestAccountId();
        String whereClause;

        System.runAs(testUser) {
            Test.startTest();

            whereClause = ObjectRecordSearchSortSupport.createCursorWhereClause(
                sortSpec,
                cursor
            );

            Test.stopTest();
        }

        Assert.isTrue(
            whereClause.contains('Name = NULL'),
            'null カーソル値は null ソートグループ内を検索する必要あり'
        );
    }

    /**
     * ソート項目と異なるページトークンは例外を送出
     */
    @IsTest
    static void shouldThrowWhenPageTokenDoesNotMatchSortField() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        Id testAccountId = getTestAccountId();
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'fieldApiName' => 'Industry',
                'recordId' => String.valueOf(testAccountId),
                'sortValue' => 'Technology'
            }
        );

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchSortSupport.parsePageToken(
                    pageToken,
                    sortSpec
                );
                Assert.fail('ソート条件と合わないページトークンは例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('ページ情報'),
                    'ソート条件と合わないページトークンは読み取り不可を説明する必要あり'
                );
            }

            Test.stopTest();
        }

    }

    /**
     * 壊れたページトークンはドメイン例外へ変換
     */
    @IsTest
    static void shouldThrowDomainExceptionWhenPageTokenIsMalformed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchSortSupport.parsePageToken(
                    '{malformed',
                    sortSpec
                );
                Assert.fail('壊れたページトークンは例外にする必要あり');
            } catch (ObjectRecordSearchException e) {
                Assert.isTrue(
                    e.getMessage().contains('ページ情報'),
                    '壊れたページトークンは検索例外に変換する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    private static ObjectRecordSearchContext createAccountContext() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            objectDescribe.fields.getMap().get('Name').getDescribe(),
            objectDescribe
        )
            .withDisplayFields(new List<ObjectRecordSearchFieldWrapper>{
                new ObjectRecordSearchFieldWrapper(
                    'Industry',
                    'Industry',
                    'text'
                )
            });
        return service.createSearchContext(
            config,
            objectDescribe.fields.getMap().get('Name').getDescribe(),
            objectDescribe
        );
    }

    private static ObjectRecordSearchContext createAccountContextWithDescription() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = service.requireDefinition(
            'accounts'
        );
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Schema.DescribeFieldResult nameFieldDescribe = objectDescribe.fields
            .getMap()
            .get('Name')
            .getDescribe();
        ObjectRecordSearchConfigWrapper config = service.createObjectConfig(
            definition,
            nameFieldDescribe,
            objectDescribe
        )
            .withDisplayFields(new List<ObjectRecordSearchFieldWrapper>{
                new ObjectRecordSearchFieldWrapper(
                    'Description',
                    'Description',
                    'text'
                )
            });
        return service.createSearchContext(
            config,
            nameFieldDescribe,
            objectDescribe
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

    private static ObjectRecordSearchSortSupport.PageCursor createParsedCursor(ObjectRecordSearchConfigWrapper config, ObjectRecordSearchSortSupport.SortSpec sortSpec) {
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
        String pageToken = ObjectRecordSearchSortSupport.createNextPageToken(
            rows,
            sortSpec
        );
        return ObjectRecordSearchSortSupport.parsePageToken(
            pageToken,
            sortSpec
        );
    }
}