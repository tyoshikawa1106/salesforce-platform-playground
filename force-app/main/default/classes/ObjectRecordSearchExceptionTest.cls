/**
 * 汎用レコード検索例外をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchExceptionTest {
    @IsTest
    static void shouldExposeExceptionMessage() {
        ObjectRecordSearchException error;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            error = new ObjectRecordSearchException('検索条件が不正です。');
            Test.stopTest();
        }

        Assert.areEqual(
            '検索条件が不正です。',
            error.getMessage(),
            'Exception should expose the supplied message.'
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
