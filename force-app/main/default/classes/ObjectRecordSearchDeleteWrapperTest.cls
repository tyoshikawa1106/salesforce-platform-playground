/**
 * 汎用レコード検索画面の削除結果 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchDeleteWrapperTest {
    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void shouldExposeConstructorValues() {
        ObjectRecordSearchDeleteWrapper wrapper;

        System.runAs(testUser) {
            wrapper = new ObjectRecordSearchDeleteWrapper(
                2,
                1,
                new List<String>{ '削除できませんでした。' }
            );
        }

        Assert.areEqual(
            2,
            wrapper.requestedCount,
            'Delete wrapper should expose the requested count.'
        );
        Assert.areEqual(
            1,
            wrapper.deletedCount,
            'Delete wrapper should expose the deleted count.'
        );
        Assert.areEqual(
            '削除できませんでした。',
            wrapper.errors[0],
            'Delete wrapper should expose user-facing errors.'
        );
    }
}