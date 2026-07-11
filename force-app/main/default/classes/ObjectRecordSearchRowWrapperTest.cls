/**
 * 汎用レコード検索画面の一覧行 Wrapper テスト
 */
@IsTest
private with sharing class ObjectRecordSearchRowWrapperTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * レコード行の表示値を公開
     */
    @IsTest
    static void shouldExposeRecordValues() {
        Account accountRecord = TestDataFactory.createAccount(
            'Wrapper Row Account', TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        accountRecord.Industry = 'Technology';
        insert accountRecord;
        Account queriedAccount = [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Id = :accountRecord.Id
        ];
        ObjectRecordSearchRowWrapper wrapper;

        System.runAs(testUser) {
            Test.startTest();

            wrapper = new ObjectRecordSearchRowWrapper(
                queriedAccount,
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
            queriedAccount.Id,
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
}