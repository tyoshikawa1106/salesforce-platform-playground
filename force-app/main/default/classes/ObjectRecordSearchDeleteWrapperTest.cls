/**
 * 汎用レコード検索画面の削除結果 Wrapper テスト
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
                new List<String>{
                    '削除できないレコードがありました。権限や関連データを確認してください。'
                }
            );
        }

        Assert.areEqual(
            2,
            wrapper.requestedCount,
            'Delete wrapper は依頼件数を公開する必要あり'
        );
        Assert.areEqual(
            1,
            wrapper.deletedCount,
            'Delete wrapper は削除件数を公開する必要あり'
        );
        Assert.areEqual(
            '削除できないレコードがありました。権限や関連データを確認してください。',
            wrapper.errors[0],
            'Delete wrapper はユーザー向けエラーを公開する必要あり'
        );
    }
}
