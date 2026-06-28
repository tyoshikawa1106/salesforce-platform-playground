/**
 * 汎用レコード検索画面の削除結果 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchDeleteWrapperTest {
    @IsTest
    static void shouldExposeConstructorValues() {
        ObjectRecordSearchDeleteWrapper wrapper;

        System.runAs(getCurrentUser()) {
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

    private static User getCurrentUser() {
        return [SELECT Id FROM User WHERE Id = :UserInfo.getUserId()];
    }
}
