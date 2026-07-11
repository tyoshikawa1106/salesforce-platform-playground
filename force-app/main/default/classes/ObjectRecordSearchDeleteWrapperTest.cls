/**
 * 汎用レコード検索画面の削除結果 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchDeleteWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * コンストラクタで受け取った値を公開
     */
    @IsTest
    static void shouldExposeConstructorValues() {
        ObjectRecordSearchDeleteWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchDeleteWrapper(
                2,
                1,
                new List<String>{
                    '削除できないレコードがありました。権限や関連データを確認してください。'
                }
            );

            Test.stopTest();
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