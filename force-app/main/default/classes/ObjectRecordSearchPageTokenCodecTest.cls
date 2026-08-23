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
}
