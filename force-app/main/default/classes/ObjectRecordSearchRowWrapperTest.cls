/**
 * 汎用レコード検索画面の一覧行 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchRowWrapperTest {
    @IsTest
    static void shouldExposeRecordValues() {
        Account accountRecord = TestDataFactory.createAccount(
            'Wrapper Row Account'
        );
        accountRecord.Industry = 'Technology';
        insert accountRecord;

        Account queriedAccount = [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Id = :accountRecord.Id
        ];
        ObjectRecordSearchRowWrapper wrapper;

        System.runAs(TestDataFactory.currentUser()) {
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
        }

        Assert.areEqual(
            queriedAccount.Id,
            wrapper.id,
            'Row wrapper should expose the record Id.'
        );
        Assert.areEqual(
            'Wrapper Row Account',
            wrapper.name,
            'Row wrapper should expose the name field value.'
        );
        Assert.isTrue(
            wrapper.recordUrl.contains('/lightning/r/Account/'),
            'Row wrapper should expose the standard record URL.'
        );
        Assert.areEqual(
            'Technology',
            wrapper.fieldValues.get('Industry'),
            'Row wrapper should expose configured field values.'
        );
    }
}