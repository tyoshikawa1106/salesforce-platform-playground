/**
 * 汎用レコード検索画面のページ状態 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchPageStateWrapperTest {
    @IsTest
    static void shouldExposeAssignedValues() {
        ObjectRecordSearchPageStateWrapper wrapper;

        System.runAs(getCurrentUser()) {
            wrapper = new ObjectRecordSearchPageStateWrapper();
            wrapper.pageSize = 50;
            wrapper.pageNumber = 3;
            wrapper.nextPageToken = 'next-token';
        }

        Assert.areEqual(
            50,
            wrapper.pageSize,
            'Page state wrapper should expose the page size.'
        );
        Assert.areEqual(
            3,
            wrapper.pageNumber,
            'Page state wrapper should expose the page number.'
        );
        Assert.areEqual(
            'next-token',
            wrapper.nextPageToken,
            'Page state wrapper should expose the next page token.'
        );
    }

    private static User getCurrentUser() {
        return [SELECT Id FROM User WHERE Id = :UserInfo.getUserId()];
    }
}
