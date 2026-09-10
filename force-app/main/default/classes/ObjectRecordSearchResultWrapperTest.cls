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
                .withPageState(2, null, 50);

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
            50,
            wrapper.nextIndex,
            'Result wrapper は次ページの取得位置を公開する必要あり'
        );
        Assert.isFalse(
            wrapper.hasNextPage,
            'Result wrapper はカーソルがない場合は次ページなしとして扱う必要あり'
        );
    }

    /**
     * null のレコード一覧と取得位置を既定値へ変換
     */
    @IsTest
    static void shouldNormalizeNullResultValues() {
        ObjectRecordSearchResultWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchResultWrapper(
                createConfigWrapper(),
                null
            )
                .withPageState(null, null, null);

            Test.stopTest();
        }

        Assert.isTrue(wrapper.records.isEmpty(), 'null のレコード一覧は空の一覧へ変換する必要あり');
        Assert.areEqual(50, wrapper.pageSize, 'ページサイズは50件固定である必要あり');
        Assert.areEqual(1, wrapper.pageNumber, 'null のページ番号は 1 へ変換する必要あり');
        Assert.areEqual(0, wrapper.nextIndex, 'null の取得位置は0へ変換する必要あり');
        Assert.isFalse(wrapper.hasNextPage, 'カーソルなしの状態は次ページなしとして扱う必要あり');
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