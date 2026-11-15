/**
 * 汎用レコード検索画面の検索リクエスト Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchRequestWrapperTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 検索リクエストの未指定項目を既定値で初期化
     */
    @IsTest
    static void shouldInitializeDefaultValues() {
        ObjectRecordSearchRequestWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchRequestWrapper();

            Test.stopTest();
        }

        Assert.areEqual('', wrapper.metricKey, 'Request wrapper は空のメトリクスキーで初期化する必要あり');
        Assert.areEqual('', wrapper.searchTerm, 'Request wrapper は空の検索語で初期化する必要あり');
        Assert.areEqual(0, wrapper.startIndex, 'Request wrapper は先頭の取得位置で初期化する必要あり');
        Assert.isNull(wrapper.paginationCursor, '初回表示ではカーソル未取得');
        Assert.areEqual('', wrapper.sortBy, 'Request wrapper は空のソート項目で初期化する必要あり');
        Assert.areEqual('asc', wrapper.sortDirection, 'Request wrapper は昇順で初期化する必要あり');
        Assert.areEqual(1, wrapper.pageNumber, 'Request wrapper は 1 ページ目で初期化する必要あり');
    }
}