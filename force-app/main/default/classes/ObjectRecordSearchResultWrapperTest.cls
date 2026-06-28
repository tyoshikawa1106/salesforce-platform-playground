/**
 * 汎用レコード検索画面の検索結果 Wrapper をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchResultWrapperTest {
    @IsTest
    static void shouldExposeResultValuesAndNextPageState() {
        ObjectRecordSearchConfigWrapper config = createConfigWrapper();
        ObjectRecordSearchResultWrapper wrapper;

        System.runAs(TestDataFactory.currentUser()) {
            wrapper = new ObjectRecordSearchResultWrapper(
                config,
                new List<ObjectRecordSearchRowWrapper>()
            )
                .withPageState(50, 2, 'next-token');
        }

        Assert.areEqual(
            'accounts',
            wrapper.config.metricKey,
            'Result wrapper should expose the config wrapper.'
        );
        Assert.areEqual(
            0,
            wrapper.records.size(),
            'Result wrapper should expose record rows.'
        );
        Assert.areEqual(
            50,
            wrapper.pageSize,
            'Result wrapper should expose the page size.'
        );
        Assert.areEqual(
            2,
            wrapper.pageNumber,
            'Result wrapper should expose the page number.'
        );
        Assert.areEqual(
            'next-token',
            wrapper.nextPageToken,
            'Result wrapper should expose the next page token.'
        );
        Assert.isTrue(
            wrapper.hasNextPage,
            'Result wrapper should mark a nonblank next page token as available.'
        );
    }

    private static ObjectRecordSearchConfigWrapper createConfigWrapper() {
        Schema.DescribeSObjectResult objectDescribe = Account.SObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        return new ObjectRecordSearchConfigWrapper(
            ObjectMetricCatalog.getDefinition('accounts'),
            Account.Name.getDescribe(),
            objectDescribe
        )
            .withDisplayFields(new List<ObjectRecordSearchFieldWrapper>());
    }
}
