/**
 * 汎用レコード検索画面の検索リクエスト Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchRequestWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 代入された検索リクエスト値を公開
     */
    @IsTest
    static void shouldExposeAssignedValues() {
        ObjectRecordSearchRequestWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchRequestWrapper();
            wrapper.metricKey = 'accounts';
            wrapper.searchTerm = 'Alpha';
            wrapper.pageToken = 'token';
            wrapper.sortBy = 'Name';
            wrapper.sortDirection = 'asc';
            wrapper.pageNumber = 2;

            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            wrapper.metricKey,
            'Request wrapper はメトリクスキーを公開する必要あり'
        );
        Assert.areEqual(
            'Alpha',
            wrapper.searchTerm,
            'Request wrapper は検索語を公開する必要あり'
        );
        Assert.areEqual(
            'token',
            wrapper.pageToken,
            'Request wrapper はページトークンを公開する必要あり'
        );
        Assert.areEqual(
            'Name',
            wrapper.sortBy,
            'Request wrapper はソート項目を公開する必要あり'
        );
        Assert.areEqual(
            'asc',
            wrapper.sortDirection,
            'Request wrapper はソート方向を公開する必要あり'
        );
        Assert.areEqual(
            2,
            wrapper.pageNumber,
            'Request wrapper はページ番号を公開する必要あり'
        );
    }

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
        Assert.areEqual('', wrapper.pageToken, 'Request wrapper は空のページトークンで初期化する必要あり');
        Assert.areEqual('', wrapper.sortBy, 'Request wrapper は空のソート項目で初期化する必要あり');
        Assert.areEqual('asc', wrapper.sortDirection, 'Request wrapper は昇順で初期化する必要あり');
        Assert.areEqual(1, wrapper.pageNumber, 'Request wrapper は 1 ページ目で初期化する必要あり');
    }
}