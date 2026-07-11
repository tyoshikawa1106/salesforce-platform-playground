/**
 * 汎用レコード検索例外テスト
 */
@IsTest
private with sharing class ObjectRecordSearchExceptionTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 例外メッセージを呼び出し元へ公開
     */
    @IsTest
    static void shouldExposeExceptionMessage() {
        ObjectRecordSearchException e;

        System.runAs(testUser) {
            Test.startTest();

            e = new ObjectRecordSearchException('検索条件が不正');

            Test.stopTest();
        }

        Assert.areEqual(
            '検索条件が不正',
            e.getMessage(),
            'Exception は指定されたメッセージを公開する必要あり'
        );
    }
}