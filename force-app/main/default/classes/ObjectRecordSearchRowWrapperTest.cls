/**
 * 汎用レコード検索画面の一覧行 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchRowWrapperTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * レコード行の表示値を公開
     */
    @IsTest
    static void shouldExposeRecordValues() {
        Account accountRecord = new Account(Id = Id.valueOf(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'), Name = 'Wrapper Row Account');
        accountRecord.Industry = 'Technology';
        ObjectRecordSearchRowWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchRowWrapper(
                accountRecord,
                'Name',
                new List<ObjectRecordSearchFieldWrapper>{
                    new ObjectRecordSearchFieldWrapper(
                        'Industry',
                        'Industry',
                        'text'
                    )
                }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            accountRecord.Id,
            wrapper.id,
            'Row wrapper はレコード ID を公開する必要あり'
        );
        Assert.areEqual(
            'Wrapper Row Account',
            wrapper.name,
            'Row wrapper は名前項目値を公開する必要あり'
        );
        Assert.isTrue(
            wrapper.recordUrl.contains('/lightning/r/Account/'),
            'Row wrapper は標準レコード URL を公開する必要あり'
        );
        Assert.areEqual(
            'Technology',
            wrapper.fieldValues.get('Industry'),
            'Row wrapper は設定済み項目値を公開する必要あり'
        );
    }

    /**
     * null の表示項目一覧を空の表示値 Map へ変換
     */
    @IsTest
    static void shouldNormalizeNullDisplayFields() {
        Account accountRecord = new Account(Name = 'Wrapper Empty Field Account');
        ObjectRecordSearchRowWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchRowWrapper(
                accountRecord,
                'Name',
                null
            );

            Test.stopTest();
        }

        Assert.isTrue(wrapper.fieldValues.isEmpty(), 'null の表示項目一覧は空の Map へ変換する必要あり');
    }
}