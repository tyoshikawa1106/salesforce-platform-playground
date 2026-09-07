/**
 * ページトークンの対象オブジェクト境界テスト
 */
@IsTest
private with sharing class ObjectRecordSearchPageTokenCodecTest {

    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupTestData() {
        Account accountRecord = TestDataFactory.createAccount(
            'ページトークン境界テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        TestDataFactory.createContact(
            accountRecord,
            '対象外ID',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
    }

    /**
     * 対象外SObjectの有効なIDを持つトークンは無効と判定
     */
    @IsTest
    static void shouldRejectPageTokenWhenRecordIdBelongsToDifferentObject() {
        Contact contactRecord = [
            SELECT Id
            FROM Contact
            LIMIT 1
        ];
        ObjectRecordSearchService service = new ObjectRecordSearchService();
        ObjectRecordSearchService.SearchContextResult contextResult = service.resolveSearchContext(
            'accounts'
        );
        ObjectRecordSearchSortSupport.SortSpec sortSpec = service.createSortSpec(
            contextResult.context,
            new ObjectRecordSearchRequestWrapper()
        );
        String pageToken = JSON.serialize(
            new Map<String, String>{
                'objectApiName' => 'Account',
                'fieldApiName' => 'Name',
                'sortDirection' => 'asc',
                'recordId' => String.valueOf(contactRecord.Id),
                'sortValue' => '境界値'
            }
        );
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchPageTokenCodec.parsePageToken(
                pageToken,
                sortSpec
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, '対象外SObjectのIDを持つトークンは無効にする必要あり');
        Assert.isNull(result.cursor, '対象外SObjectのIDからカーソルを返さない必要あり');
    }

    /**
     * JSON object 以外のトークンは無効と判定
     */
    @IsTest
    static void shouldRejectNullJsonToken() {
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchPageTokenCodec.parsePageToken(
                'null',
                createSortSpec('Name')
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, 'JSON null はページ境界として利用しない必要あり');
        Assert.isNull(result.cursor, 'JSON null からカーソルを返さない必要あり');
    }

    /**
     * 文字列ではないトークン属性は無効と判定
     */
    @IsTest
    static void shouldRejectTokenWhenAttributeTypeIsInvalid() {
        Map<String, Object> tokenParts = createTokenParts(
            'Name',
            'Cursor Account'
        );
        tokenParts.put('objectApiName', 1);
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchPageTokenCodec.parsePageToken(
                JSON.serialize(tokenParts),
                createSortSpec('Name')
            );

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, '型が異なるトークン属性は無効にする必要あり');
        Assert.isNull(result.cursor, '型が異なるトークン属性からカーソルを返さない必要あり');
    }

    /**
     * null のソート値をカーソルへ復元
     */
    @IsTest
    static void shouldParseNullSortValue() {
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = parseToken('Industry', null);

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, 'null のソート値を持つ有効なトークンを受け付ける必要あり');
        Assert.isNull(result.cursor.sortValue, 'null のソート値を維持する必要あり');
    }

    /**
     * Date のソート値をカーソルへ復元
     */
    @IsTest
    static void shouldParseDateSortValue() {
        Date expectedSortValue = Date.newInstance(2026, 8, 23);
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = parseToken(
                'LastActivityDate',
                String.valueOf(expectedSortValue)
            );

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, 'Date のソート値を持つ有効なトークンを受け付ける必要あり');
        Assert.areEqual(expectedSortValue, result.cursor.sortValue, 'Date のソート値を復元する必要あり');
    }

    /**
     * Datetime のソート値をカーソルへ復元
     */
    @IsTest
    static void shouldParseDatetimeSortValue() {
        Datetime expectedSortValue = Datetime.valueOfGmt('2026-08-23 12:30:00');
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = parseToken(
                'CreatedDate',
                expectedSortValue
            );

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, 'Datetime のソート値を持つ有効なトークンを受け付ける必要あり');
        Assert.areEqual(expectedSortValue, result.cursor.sortValue, 'Datetime のソート値を復元する必要あり');
    }

    /**
     * 数値のソート値をカーソルへ復元
     */
    @IsTest
    static void shouldParseNumericSortValue() {
        Decimal expectedSortValue = 1234.5;
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = parseToken(
                'AnnualRevenue',
                String.valueOf(expectedSortValue)
            );

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, '数値のソート値を持つ有効なトークンを受け付ける必要あり');
        Assert.areEqual(expectedSortValue, result.cursor.sortValue, '数値のソート値を復元する必要あり');
    }

    /**
     * Boolean のソート値をカーソルへ復元
     */
    @IsTest
    static void shouldParseBooleanSortValue() {
        Boolean expectedSortValue = true;
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = parseToken(
                'IsDeleted',
                String.valueOf(expectedSortValue)
            );

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, 'Boolean のソート値を持つ有効なトークンを受け付ける必要あり');
        Assert.areEqual(expectedSortValue, result.cursor.sortValue, 'Boolean のソート値を復元する必要あり');
    }

    /**
     * 数値のnullの元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripNullNumberFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = null;
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('AnnualRevenue', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のAnnualRevenue値を型とともに復元する必要あり');
        }
    }

    /**
     * 日付のnullの元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripNullDateFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = null;
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('LastActivityDate', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のLastActivityDate値を型とともに復元する必要あり');
        }
    }

    /**
     * 日時のnullの元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripNullDatetimeFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = null;
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('CreatedDate', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のCreatedDate値を型とともに復元する必要あり');
        }
    }

    /**
     * 名前のnullの元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripNullNameFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = null;
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('Name', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のName値を型とともに復元する必要あり');
        }
    }

    /**
     * falseの元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripFalseFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = false;
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('IsDeleted', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のIsDeleted値を型とともに復元する必要あり');
        }
    }

    /**
     * ゼロの元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripZeroFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = Decimal.valueOf('0');
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('AnnualRevenue', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のAnnualRevenue値を型とともに復元する必要あり');
        }
    }

    /**
     * 日付の元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripDateFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = Date.newInstance(2026, 9, 7);
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('LastActivityDate', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のLastActivityDate値を型とともに復元する必要あり');
        }
    }

    /**
     * 日時の元レコード値を表示とページ境界で保持
     */
    @IsTest
    static void shouldRoundTripDatetimeFromRecord() {
        System.runAs(testUser) {
            Test.startTest();
            Object expectedValue = Datetime.newInstance(1788739200123L);
            ObjectRecordSearchSortSupport.PageCursor cursor = createRecordRoundTripCursor('CreatedDate', expectedValue);
            Test.stopTest();
            Assert.areEqual(expectedValue, cursor.sortValue, '元のCreatedDate値を型とともに復元する必要あり');
        }
    }

    private static ObjectRecordSearchSortSupport.PageCursor createRecordRoundTripCursor(String fieldApiName, Object expectedValue) {
        // 読み取り専用項目も取得済みSObjectと同じ型で用意
        Map<String, Object> recordValues = new Map<String, Object>{
            'Id' => getTestAccountId(), 'Name' => 'Cursor Account'
        };
        recordValues.put(fieldApiName, expectedValue);
        Account record = (Account) JSON.deserialize(JSON.serialize(recordValues), Account.class);
        ObjectRecordSearchRowWrapper row = new ObjectRecordSearchRowWrapper(
            record, 'Name', new List<ObjectRecordSearchFieldWrapper>{
                new ObjectRecordSearchFieldWrapper(fieldApiName, fieldApiName, 'text')
            }
        );
        // 表示MapからJSONへ渡る際もfalse・0・null・日時を保持
        Map<String, Object> actualValues = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(row.fieldValues));
        Object expectedJsonValue = JSON.deserializeUntyped(JSON.serialize(expectedValue));
        Assert.areEqual(expectedJsonValue, actualValues.get(fieldApiName), '表示値の型とnullを維持する必要あり');
        // 同じ元レコードから発行したtokenを次のリクエストとして復元
        ObjectRecordSearchSortSupport.SortSpec sortSpec = createSortSpec(fieldApiName);
        String token = ObjectRecordSearchSortSupport.createNextPageToken(record, sortSpec);
        ObjectRecordSearchPageTokenCodec.ParseResult parsed = ObjectRecordSearchSortSupport.parsePageToken(token, sortSpec);
        Assert.isTrue(parsed.isValid, '元レコードから生成したtokenを解析できる必要あり');
        Assert.areEqual(record.Id, parsed.cursor.recordId, '同値ソート時のId境界を維持する必要あり');
        if (fieldApiName == 'Name' && expectedValue == null) {
            Assert.areEqual(String.valueOf(record.Id), row.name, '表示ラベルだけはIdで補う必要あり');
        }
        return parsed.cursor;
    }

    private static ObjectRecordSearchPageTokenCodec.ParseResult parseToken(String fieldApiName, Object sortValue) {
        ObjectRecordSearchPageTokenCodec.ParseResult result = ObjectRecordSearchPageTokenCodec.parsePageToken(
            JSON.serialize(createTokenParts(fieldApiName, sortValue)),
            createSortSpec(fieldApiName)
        );
        return result;
    }

    private static Map<String, Object> createTokenParts(String fieldApiName, Object sortValue) {
        return new Map<String, Object>{
            'objectApiName' => 'Account',
            'fieldApiName' => fieldApiName,
            'sortDirection' => 'asc',
            'recordId' => String.valueOf(getTestAccountId()),
            'sortValue' => sortValue
        };
    }

    private static ObjectRecordSearchSortSupport.SortSpec createSortSpec(String fieldApiName) {
        ObjectRecordSearchSortSupport.SortSpec sortSpec = new ObjectRecordSearchSortSupport.SortSpec();
        sortSpec.objectApiName = 'Account';
        sortSpec.fieldApiName = fieldApiName;
        sortSpec.direction = 'asc';
        sortSpec.fieldDescribe = Account.SObjectType.getDescribe(
                SObjectDescribeOptions.DEFERRED
            )
            .fields.getMap()
            .get(fieldApiName)
            .getDescribe();
        sortSpec.nameFieldApiName = 'Name';
        return sortSpec;
    }

    private static Id getTestAccountId() {
        return [
            SELECT Id
            FROM Account
            LIMIT 1
        ].Id;
    }
}