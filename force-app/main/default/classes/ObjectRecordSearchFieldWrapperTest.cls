/**
 * 汎用レコード検索画面の固定項目 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchFieldWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * コンストラクタで受け取った値を公開
     */
    @IsTest
    static void shouldExposeConstructorValues() {
        ObjectRecordSearchFieldWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchFieldWrapper(
                'Industry',
                'Industry',
                'text'
            );

            Test.stopTest();
        }

        Assert.areEqual(
            'Industry',
            wrapper.apiName,
            'Field wrapper は API 名を公開する必要あり'
        );
        Assert.areEqual(
            'Industry',
            wrapper.label,
            'Field wrapper はラベルを公開する必要あり'
        );
        Assert.areEqual(
            'text',
            wrapper.dataType,
            'Field wrapper はデータテーブル型を公開する必要あり'
        );
    }

    /**
     * null の表示項目値を空文字列へ変換
     */
    @IsTest
    static void shouldNormalizeNullConstructorValues() {
        ObjectRecordSearchFieldWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchFieldWrapper(null, null, null);

            Test.stopTest();
        }

        Assert.areEqual('', wrapper.apiName, 'null の API 名は空文字列へ変換する必要あり');
        Assert.areEqual('', wrapper.label, 'null のラベルは空文字列へ変換する必要あり');
        Assert.areEqual('', wrapper.dataType, 'null の表示型は空文字列へ変換する必要あり');
    }
}