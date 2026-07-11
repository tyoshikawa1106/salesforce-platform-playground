/**
 * 汎用レコード検索画面の検索結果 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchResultWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 検索結果と次ページ有無を公開
     */
    @IsTest
    static void shouldExposeResultValuesAndNextPageState() {
        ObjectRecordSearchConfigWrapper config = createConfigWrapper();
        ObjectRecordSearchResultWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchResultWrapper(
                config,
                new List<ObjectRecordSearchRowWrapper>()
            )
                .withPageState(50, 2, 'next-token');

            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            wrapper.config.metricKey,
            'Result wrapper は config wrapper を公開する必要あり'
        );
        Assert.areEqual(
            0,
            wrapper.records.size(),
            'Result wrapper はレコード行を公開する必要あり'
        );
        Assert.areEqual(
            50,
            wrapper.pageSize,
            'Result wrapper はページサイズを公開する必要あり'
        );
        Assert.areEqual(
            2,
            wrapper.pageNumber,
            'Result wrapper はページ番号を公開する必要あり'
        );
        Assert.areEqual(
            'next-token',
            wrapper.nextPageToken,
            'Result wrapper は次ページトークンを公開する必要あり'
        );
        Assert.isTrue(
            wrapper.hasNextPage,
            'Result wrapper は空でない次ページトークンを利用可能として扱う必要あり'
        );
    }

    private static ObjectRecordSearchConfigWrapper createConfigWrapper() {
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        return new ObjectRecordSearchConfigWrapper(
            ObjectMetricCatalog.getDefinition('accounts'),
            Account.Name.getDescribe(),
            objectDescribe
        )
            .withDisplayFields(new List<ObjectRecordSearchFieldWrapper>());
    }
}
