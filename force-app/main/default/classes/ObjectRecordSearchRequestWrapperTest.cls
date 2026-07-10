/**
 * 汎用レコード検索画面の検索リクエスト Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchRequestWrapperTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldExposeAssignedValues() {
        ObjectRecordSearchRequestWrapper wrapper;

        System.runAs(testUser) {
            wrapper = new ObjectRecordSearchRequestWrapper();
            wrapper.metricKey = 'accounts';
            wrapper.searchTerm = 'Alpha';
            wrapper.pageToken = 'token';
            wrapper.sortBy = 'Name';
            wrapper.sortDirection = 'asc';
            wrapper.pageNumber = 2;
        }

        Assert.areEqual(
            'accounts',
            wrapper.metricKey,
            'Request wrapper should expose the metric key.'
        );
        Assert.areEqual(
            'Alpha',
            wrapper.searchTerm,
            'Request wrapper should expose the search term.'
        );
        Assert.areEqual(
            'token',
            wrapper.pageToken,
            'Request wrapper should expose the page token.'
        );
        Assert.areEqual(
            'Name',
            wrapper.sortBy,
            'Request wrapper should expose the sort field.'
        );
        Assert.areEqual(
            'asc',
            wrapper.sortDirection,
            'Request wrapper should expose the sort direction.'
        );
        Assert.areEqual(
            2,
            wrapper.pageNumber,
            'Request wrapper should expose the page number.'
        );
    }
}