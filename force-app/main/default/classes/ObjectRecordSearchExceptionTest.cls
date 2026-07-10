/**
 * 汎用レコード検索例外テスト
 */
@IsTest
private with sharing class ObjectRecordSearchExceptionTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldExposeExceptionMessage() {
        ObjectRecordSearchException error;

        System.runAs(testUser) {
            Test.startTest();
            error = new ObjectRecordSearchException('検索条件が不正');
            Test.stopTest();
        }

        Assert.areEqual(
            '検索条件が不正',
            error.getMessage(),
            'Exception should expose the supplied message.'
        );
    }
}