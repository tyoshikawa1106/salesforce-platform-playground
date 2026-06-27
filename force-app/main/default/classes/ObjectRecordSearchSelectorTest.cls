/**
 * 汎用レコード検索 Selector の検索・削除条件を直接テストします。
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = TestDataFactory.createAccounts(4);
        accounts[0].Name = 'Selector Alpha';
        accounts[0].Industry = 'Technology';
        accounts[0].Type = 'Prospect';
        accounts[1].Name = 'Selector Beta';
        accounts[2].Name = 'Selector Delete One';
        accounts[3].Name = 'Selector Delete Two';
        insert accounts;
    }

    @IsTest
    static void searchRecordsShouldFilterByBoundNameTerm() {
        ObjectRecordSearchController.ObjectRecordSearchRequest request = createSearchRequest(
            'accounts',
            ' Alpha '
        );
        request.pageNumber = 1;
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = selector.searchRecords(request);
            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.records.size(),
            'Selector should bind trimmed search terms and return matching records only.'
        );
        Assert.areEqual(
            'Selector Alpha',
            result.records[0].name,
            'Selector row should expose the matching Account name.'
        );
        Assert.areEqual(
            50,
            result.pageSize,
            'Selector result should expose the configured page size.'
        );
        Assert.areEqual(
            'Technology',
            result.records[0].fieldValues.get('Industry'),
            'Selector rows should expose fixed seed/import fields.'
        );
        Assert.areEqual(
            'Prospect',
            result.records[0].fieldValues.get('Type'),
            'Selector rows should include Account Type.'
        );
    }

    @IsTest
    static void getObjectConfigShouldExposeFixedDisplayFields() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordSearchConfig config;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            config = selector.getObjectConfig('accounts');
            Test.stopTest();
        }

        Set<String> displayFieldApiNames = new Set<String>();
        for (
            ObjectRecordSearchController.ObjectRecordDisplayField displayField : config.displayFields
        ) {
            displayFieldApiNames.add(displayField.apiName);
        }

        Assert.isTrue(
            displayFieldApiNames.contains('Industry'),
            'Account display fields should include Industry.'
        );
        Assert.isTrue(
            displayFieldApiNames.contains('Type'),
            'Account display fields should include Type.'
        );
        Assert.isFalse(
            displayFieldApiNames.contains('Description'),
            'Account display fields should not include Description.'
        );
    }

    @IsTest
    static void searchRecordsShouldReturnRowsWhenSearchTermIsBlank() {
        ObjectRecordSearchController.ObjectRecordSearchRequest request = createSearchRequest(
            'accounts',
            ' '
        );
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = selector.searchRecords(request);
            Test.stopTest();
        }

        Assert.areEqual(
            4,
            result.records.size(),
            'Blank selector searches should return all visible setup Accounts.'
        );
        Assert.areEqual(
            'Selector Alpha',
            result.records[0].name,
            'Blank selector searches should order rows by Name ascending.'
        );
        Assert.areEqual(
            'Selector Beta',
            result.records[1].name,
            'Blank selector searches should keep Name ascending order.'
        );
    }

    @IsTest
    static void searchRecordsShouldPageWithCursorToken() {
        List<Account> accounts = TestDataFactory.createAccounts(51);
        for (Integer index = 0; index < accounts.size(); index++) {
            accounts[index].Name = 'Selector Page ' + index;
        }
        insert accounts;

        ObjectRecordSearchController.ObjectRecordSearchRequest firstRequest = createSearchRequest(
            'accounts',
            'Selector Page'
        );
        firstRequest.pageNumber = 1;
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordSearchResult firstPage;
        ObjectRecordSearchController.ObjectRecordSearchResult secondPage;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            firstPage = selector.searchRecords(firstRequest);

            ObjectRecordSearchController.ObjectRecordSearchRequest secondRequest = createSearchRequest(
                'accounts',
                'Selector Page'
            );
            secondRequest.pageToken = firstPage.nextPageToken;
            secondRequest.pageNumber = 2;
            secondPage = selector.searchRecords(secondRequest);
            Test.stopTest();
        }

        Assert.areEqual(
            50,
            firstPage.records.size(),
            'First page should return the configured number of rows.'
        );
        Assert.isTrue(
            firstPage.hasNextPage,
            'First page should indicate that another page exists.'
        );
        Assert.isNotNull(
            firstPage.nextPageToken,
            'First page should include a cursor token for the next page.'
        );
        Assert.areEqual(
            1,
            secondPage.records.size(),
            'Second page should return the remaining matching row.'
        );
        Assert.areEqual(
            2,
            secondPage.pageNumber,
            'Second page should preserve the requested page number.'
        );
        Assert.isFalse(
            secondPage.hasNextPage,
            'Second page should indicate there are no more rows.'
        );
    }

    @IsTest
    static void deleteRecordsShouldDeleteMultipleBoundIds() {
        List<Account> deleteTargets = [
            SELECT Id
            FROM Account
            WHERE Name LIKE 'Selector Delete%'
            ORDER BY Name
        ];
        List<Id> recordIds = new List<Id>();
        for (Account accountRecord : deleteTargets) {
            recordIds.add(accountRecord.Id);
        }

        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordDeleteResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = selector.deleteRecords('accounts', recordIds);
            Test.stopTest();
        }

        Assert.areEqual(
            2,
            result.requestedCount,
            'Delete result should count all requested IDs.'
        );
        Assert.areEqual(
            2,
            result.deletedCount,
            'Selector should delete all selected Account records.'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            'Successful selector deletes should not expose errors.'
        );
        Assert.areEqual(
            0,
            [
                SELECT COUNT()
                FROM Account
                WHERE Id IN :recordIds AND IsDeleted = FALSE
                ALL ROWS
            ],
            'Deleted records should no longer be active.'
        );
    }

    @IsTest
    static void getObjectConfigShouldThrowWhenMetricKeyIsUnsupported() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(getCurrentUser()) {
            Test.startTest();
            try {
                selector.getObjectConfig('unknown');
                Assert.fail('Unsupported metric keys should throw.');
            } catch (
                ObjectRecordSearchSelector.ObjectRecordSearchException error
            ) {
                Assert.isTrue(
                    error.getMessage().contains('未対応'),
                    'Unsupported metric keys should explain that the object is unsupported.'
                );
            }
            Test.stopTest();
        }
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }

    private static ObjectRecordSearchController.ObjectRecordSearchRequest createSearchRequest(
        String metricKey,
        String searchTerm
    ) {
        ObjectRecordSearchController.ObjectRecordSearchRequest request = new ObjectRecordSearchController.ObjectRecordSearchRequest();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }
}
