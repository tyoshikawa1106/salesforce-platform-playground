/**
 * 汎用レコード検索画面の参照権限 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchAccessWrapperTest {
    @IsTest
    static void shouldExposeDescribeAccessAndFields() {
        Schema.DescribeSObjectResult accountDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        List<ObjectRecordSearchFieldWrapper> displayFields = new List<ObjectRecordSearchFieldWrapper>{
            new ObjectRecordSearchFieldWrapper('Industry', 'Industry', 'text')
        };
        ObjectRecordSearchAccessWrapper wrapper;

        System.runAs(getCurrentUser()) {
            wrapper = new ObjectRecordSearchAccessWrapper(
                accountDescribe,
                displayFields
            );
        }

        Assert.areEqual(
            accountDescribe.isDeletable(),
            wrapper.deletable,
            'Access wrapper should expose delete permission.'
        );
        Assert.areEqual(
            accountDescribe.isCreateable(),
            wrapper.createable,
            'Access wrapper should expose create permission.'
        );
        Assert.areEqual(
            accountDescribe.isUpdateable(),
            wrapper.updateable,
            'Access wrapper should expose update permission.'
        );
        Assert.areEqual(
            'Industry',
            wrapper.displayFields[0].apiName,
            'Access wrapper should keep display fields.'
        );
    }

    private static User getCurrentUser() {
        return [SELECT Id FROM User WHERE Id = :UserInfo.getUserId()];
    }
}
