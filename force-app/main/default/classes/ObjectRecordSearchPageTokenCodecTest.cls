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
        Datetime expectedSortValue = Datetime.valueOf('2026-08-23 12:30:00');
        ObjectRecordSearchPageTokenCodec.ParseResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = parseToken(
                'CreatedDate',
                String.valueOf(expectedSortValue)
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
