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
    static void shouldReturnEmptyTokenWhenRowsAreMissing() {
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

        Assert.areEqual(
            '',
            pageToken,
            '空の行リストは空のページトークンを返す必要あり'
        );
    }

    /**
     * ソート方向がない旧形式ページトークンは無効と判定
     */
    @IsTest
    static void shouldReturnInvalidResultWhenLegacyPageTokenLacksSortDirection() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        Id testAccountId = getTestAccountId();
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'objectApiName' => 'Account',
                'fieldApiName' => 'Name',
                'recordId' => String.valueOf(testAccountId),
                'sortValue' => 'Cursor Account'
            }
        );
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, 'ソート方向がないページトークンは無効にする必要あり');
        Assert.isNull(result.cursor, '無効なページトークンからカーソルを返さない必要あり');
    }

    /**
     * ソート項目と異なるページトークンは無効と判定
     */
    @IsTest
    static void shouldReturnInvalidResultWhenPageTokenDoesNotMatchSortField() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        Id testAccountId = getTestAccountId();
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'objectApiName' => 'Account',
                'fieldApiName' => 'Industry',
                'sortDirection' => 'asc',
                'recordId' => String.valueOf(testAccountId),
                'sortValue' => 'Technology'
            }
        );
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, 'ソート項目が一致しないページトークンは無効にする必要あり');
        Assert.isNull(result.cursor, '無効なページトークンからカーソルを返さない必要あり');
    }

    /**
     * ソート方向と異なるページトークンは無効と判定
     */
    @IsTest
    static void shouldReturnInvalidResultWhenPageTokenDoesNotMatchSortDirection() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        Id testAccountId = getTestAccountId();
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'objectApiName' => 'Account',
                'fieldApiName' => 'Name',
                'sortDirection' => 'desc',
                'recordId' => String.valueOf(testAccountId),
                'sortValue' => 'Cursor Account'
            }
        );
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, 'ソート方向が一致しないページトークンは無効にする必要あり');
        Assert.isNull(result.cursor, '無効なページトークンからカーソルを返さない必要あり');
    }

    /**
     * 壊れたページトークンは無効と判定
     */
    @IsTest
    static void shouldReturnInvalidResultWhenPageTokenIsMalformed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchSortSupport.parsePageToken(
                '{malformed',
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, '壊れたページトークンは無効にする必要あり');
        Assert.isNull(result.cursor, '壊れたページトークンからカーソルを返さない必要あり');
    }

    /**
     * 内部ソート条件がない場合は契約違反として通知
     */
    @IsTest
    static void shouldThrowWhenSortSpecIsMissing() {
        String errorMessage;

        System.runAs(testUser) {
            Test.startTest();

            errorMessage = getInvalidSortSpecErrorMessage(null);

            Test.stopTest();
        }

        Assert.areEqual(
            'ページトークンの解析には検証済みのソート条件が必要です。',
            errorMessage,
            '内部ソート条件の欠落を契約違反にする必要あり'
        );
    }

    /**
     * Salesforce IDへ変換できないページトークンは無効と判定
     */
    @IsTest
    static void shouldReturnInvalidResultWhenPageTokenRecordIdIsMalformed() {
        ObjectRecordSearchContext context = createAccountContext();
        ObjectRecordSearchSortSupport.SortSpec sortSpec = ObjectRecordSearchSortSupport.createSortSpec(
            context,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'objectApiName' => 'Account',
                'fieldApiName' => 'Name',
                'sortDirection' => 'asc',
                'recordId' => 'not-an-id',
                'sortValue' => 'Cursor Account'
            }
        );
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchSortSupport.parsePageToken(
                pageToken,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, '不正なIDを含むページトークンは無効にする必要あり');
        Assert.isNull(result.cursor, '不正なIDからカーソルを返さない必要あり');
    }

    private static ObjectRecordSearchContext createAccountContext() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
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

    private static String getInvalidSortSpecErrorMessage(ObjectRecordSearchSortSupport.SortSpec sortSpec) {
        try {
            ObjectRecordSearchSortSupport.parsePageToken(null, sortSpec);
            return null;
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        }
    }

    private static ObjectRecordSearchContext createAccountContextWithDescription() {
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
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
        ObjectRecordSearchPageTokenCodec.ParseResult result = ObjectRecordSearchSortSupport.parsePageToken(
            pageToken,
            sortSpec
        );
        return result.cursor;
    }
}