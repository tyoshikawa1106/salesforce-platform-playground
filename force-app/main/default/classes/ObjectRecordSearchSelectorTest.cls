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
        accounts[0].BillingState = '東京都';
        accounts[0].BillingCity = '千代田区';
        accounts[1].Name = 'Selector Beta';
        accounts[1].Industry = 'Finance';
        accounts[2].Name = 'Selector Delete One';
        accounts[2].Industry = 'Healthcare';
        accounts[3].Name = 'Selector Delete Two';
        accounts[3].Industry = 'Retail';
        insert accounts;
    }

    @IsTest
    static void searchRecordsShouldFilterByBoundNameTerm() {
        ObjectRecordSearchDtos.ObjectRecordSearchRequest request = createSearchRequest(
            'accounts',
            ' Alpha '
        );
        request.pageNumber = 1;
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchResult result;

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
        Assert.areEqual(
            '東京都',
            result.records[0].fieldValues.get('BillingState'),
            'Selector rows should expose Account billing state as prefecture.'
        );
        Assert.areEqual(
            '千代田区',
            result.records[0].fieldValues.get('BillingCity'),
            'Selector rows should expose Account billing city.'
        );
    }

    @IsTest
    static void getObjectConfigShouldExposeFixedDisplayFields() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchConfig config;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            config = selector.getObjectConfig('accounts');
            Test.stopTest();
        }

        Set<String> displayFieldApiNames = new Set<String>();
        for (
            ObjectRecordSearchDtos.ObjectRecordDisplayField displayField : config.displayFields
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
        Assert.isTrue(
            displayFieldApiNames.contains('BillingState'),
            'Account display fields should include BillingState.'
        );
        Assert.isTrue(
            displayFieldApiNames.contains('BillingCity'),
            'Account display fields should include BillingCity.'
        );
        Assert.isFalse(
            displayFieldApiNames.contains('BillingCountry'),
            'Account display fields should not include BillingCountry.'
        );
        Assert.isFalse(
            displayFieldApiNames.contains('Description'),
            'Account display fields should not include Description.'
        );
    }

    @IsTest
    static void getObjectConfigShouldExposeAddressFieldsAsStateThenCity() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<AddressDisplayExpectation> expectations = new List<AddressDisplayExpectation>{
            new AddressDisplayExpectation(
                new List<String>{
                    'contacts',
                    'Contact',
                    'MailingState',
                    'MailingCity'
                }
            ),
            new AddressDisplayExpectation(
                new List<String>{ 'leads', 'Lead', 'State', 'City' }
            ),
            new AddressDisplayExpectation(
                new List<String>{
                    'contracts',
                    'Contract',
                    'BillingState',
                    'BillingCity'
                }
            ),
            new AddressDisplayExpectation(
                new List<String>{
                    'orders',
                    'Order',
                    'BillingState',
                    'BillingCity',
                    'BillingCountry'
                }
            ),
            new AddressDisplayExpectation(
                new List<String>{
                    'orders',
                    'Order',
                    'ShippingState',
                    'ShippingCity',
                    'ShippingCountry'
                }
            ),
            new AddressDisplayExpectation(
                new List<String>{
                    'serviceContracts',
                    'ServiceContract',
                    'BillingState',
                    'BillingCity',
                    'BillingCountry'
                }
            ),
            new AddressDisplayExpectation(
                new List<String>{
                    'serviceContracts',
                    'ServiceContract',
                    'ShippingState',
                    'ShippingCity',
                    'ShippingCountry'
                }
            ),
            new AddressDisplayExpectation(
                new List<String>{
                    'workOrders',
                    'WorkOrder',
                    'State',
                    'City',
                    'Country',
                    'PostalCode'
                }
            )
        };

        System.runAs(getCurrentUser()) {
            Test.startTest();
            for (AddressDisplayExpectation expectation : expectations) {
                assertAddressDisplayFields(selector, expectation);
            }
            Test.stopTest();
        }

        Assert.areEqual(
            8,
            expectations.size(),
            'Address display checks should cover every configured address pair.'
        );
    }

    @IsTest
    static void searchRecordsShouldReturnRowsWhenSearchTermIsBlank() {
        ObjectRecordSearchDtos.ObjectRecordSearchRequest request = createSearchRequest(
            'accounts',
            ' '
        );
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchResult result;

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
    static void searchRecordsShouldSortByAllowedDisplayField() {
        ObjectRecordSearchDtos.ObjectRecordSearchRequest request = createSearchRequest(
            'accounts',
            'Selector'
        );
        request.sortBy = 'Industry';
        request.sortDirection = 'desc';
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = selector.searchRecords(request);
            Test.stopTest();
        }

        Assert.areEqual(
            'Technology',
            result.records[0].fieldValues.get('Industry'),
            'Selector should sort by an allowed display field descending.'
        );
        Assert.areEqual(
            'Retail',
            result.records[1].fieldValues.get('Industry'),
            'Selector should keep the requested display-field sort order.'
        );
    }

    @IsTest
    static void searchRecordsShouldPageWithCursorToken() {
        List<Account> accounts = TestDataFactory.createAccounts(51);
        for (Integer index = 0; index < accounts.size(); index++) {
            accounts[index].Name = 'Selector Page ' + index;
        }
        insert accounts;

        ObjectRecordSearchDtos.ObjectRecordSearchRequest firstRequest = createSearchRequest(
            'accounts',
            'Selector Page'
        );
        firstRequest.pageNumber = 1;
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchResult firstPage;
        ObjectRecordSearchDtos.ObjectRecordSearchResult secondPage;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            firstPage = selector.searchRecords(firstRequest);

            ObjectRecordSearchDtos.ObjectRecordSearchRequest secondRequest = createSearchRequest(
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
    static void searchRecordsShouldPageWithDescendingSortCursor() {
        List<Account> accounts = TestDataFactory.createAccounts(51);
        for (Integer index = 0; index < accounts.size(); index++) {
            accounts[index].Name = 'Selector Desc Page ' + index;
        }
        insert accounts;

        ObjectRecordSearchDtos.ObjectRecordSearchRequest firstRequest = createSearchRequest(
            'accounts',
            'Selector Desc Page'
        );
        firstRequest.sortBy = 'Name';
        firstRequest.sortDirection = 'desc';
        firstRequest.pageNumber = 1;
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchResult firstPage;
        ObjectRecordSearchDtos.ObjectRecordSearchResult secondPage;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            firstPage = selector.searchRecords(firstRequest);

            ObjectRecordSearchDtos.ObjectRecordSearchRequest secondRequest = createSearchRequest(
                'accounts',
                'Selector Desc Page'
            );
            secondRequest.sortBy = 'Name';
            secondRequest.sortDirection = 'desc';
            secondRequest.pageToken = firstPage.nextPageToken;
            secondRequest.pageNumber = 2;
            secondPage = selector.searchRecords(secondRequest);
            Test.stopTest();
        }

        Assert.areEqual(
            50,
            firstPage.records.size(),
            'Descending first page should return the configured number of rows.'
        );
        Assert.areEqual(
            1,
            secondPage.records.size(),
            'Descending second page should return the remaining row.'
        );
        Assert.areEqual(
            'Selector Desc Page 0',
            secondPage.records[0].name,
            'Descending cursor should continue after the first page without repeating rows.'
        );
    }

    @IsTest
    static void searchRecordsShouldPageIntoNullSortValues() {
        List<Account> accounts = TestDataFactory.createAccounts(51);
        for (Integer index = 0; index < accounts.size(); index++) {
            accounts[index].Name = 'Selector Null Page ' + index;
            accounts[index].Industry = index < 50 ? 'Technology' : null;
        }
        insert accounts;

        ObjectRecordSearchDtos.ObjectRecordSearchRequest firstRequest = createSearchRequest(
            'accounts',
            'Selector Null Page'
        );
        firstRequest.sortBy = 'Industry';
        firstRequest.sortDirection = 'asc';
        firstRequest.pageNumber = 1;
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchDtos.ObjectRecordSearchResult firstPage;
        ObjectRecordSearchDtos.ObjectRecordSearchResult secondPage;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            firstPage = selector.searchRecords(firstRequest);

            ObjectRecordSearchDtos.ObjectRecordSearchRequest secondRequest = createSearchRequest(
                'accounts',
                'Selector Null Page'
            );
            secondRequest.sortBy = 'Industry';
            secondRequest.sortDirection = 'asc';
            secondRequest.pageToken = firstPage.nextPageToken;
            secondRequest.pageNumber = 2;
            secondPage = selector.searchRecords(secondRequest);
            Test.stopTest();
        }

        Assert.isTrue(
            firstPage.hasNextPage,
            'First page should include a cursor when null sort values remain.'
        );
        Assert.areEqual(
            1,
            secondPage.records.size(),
            'Second page should include the remaining null-sort row.'
        );
        Assert.areEqual(
            '',
            secondPage.records[0].fieldValues.get('Industry'),
            'Null sort values should remain reachable after non-null values.'
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
        ObjectRecordSearchDtos.ObjectRecordDeleteResult result;

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

    private static ObjectRecordSearchDtos.ObjectRecordSearchRequest createSearchRequest(
        String metricKey,
        String searchTerm
    ) {
        ObjectRecordSearchDtos.ObjectRecordSearchRequest request = new ObjectRecordSearchDtos.ObjectRecordSearchRequest();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }

    private static void assertAddressDisplayFields(
        ObjectRecordSearchSelector selector,
        AddressDisplayExpectation expectation
    ) {
        ObjectRecordSearchDtos.ObjectRecordSearchConfig config = selector.getObjectConfig(
            expectation.metricKey
        );
        List<String> displayFieldApiNames = getDisplayFieldApiNames(config);

        if (
            hasAccessibleField(
                expectation.objectApiName,
                expectation.stateFieldApiName
            ) &&
            hasAccessibleField(
                expectation.objectApiName,
                expectation.cityFieldApiName
            )
        ) {
            Assert.isTrue(
                displayFieldApiNames.contains(expectation.stateFieldApiName),
                expectation.objectApiName +
                    ' display fields should include state.'
            );
            Assert.isTrue(
                displayFieldApiNames.contains(expectation.cityFieldApiName),
                expectation.objectApiName +
                    ' display fields should include city.'
            );
            Assert.isTrue(
                displayFieldApiNames.indexOf(expectation.stateFieldApiName) <
                    displayFieldApiNames.indexOf(expectation.cityFieldApiName),
                expectation.objectApiName +
                    ' display fields should show state before city.'
            );
        }

        for (String excludedFieldApiName : expectation.excludedFieldApiNames) {
            Assert.isFalse(
                displayFieldApiNames.contains(excludedFieldApiName),
                expectation.objectApiName +
                    ' display fields should omit address detail fields.'
            );
        }
    }

    private static List<String> getDisplayFieldApiNames(
        ObjectRecordSearchDtos.ObjectRecordSearchConfig config
    ) {
        List<String> displayFieldApiNames = new List<String>();
        for (
            ObjectRecordSearchDtos.ObjectRecordDisplayField displayField : config.displayFields
        ) {
            displayFieldApiNames.add(displayField.apiName);
        }
        return displayFieldApiNames;
    }

    private static Boolean hasAccessibleField(
        String objectApiName,
        String fieldApiName
    ) {
        Schema.SObjectType objectType = Schema.getGlobalDescribe()
            .get(objectApiName);
        if (objectType == null) {
            return false;
        }

        Map<String, Schema.SObjectField> fieldsByApiName = objectType.getDescribe()
            .fields.getMap();
        return fieldsByApiName.containsKey(fieldApiName) &&
            fieldsByApiName.get(fieldApiName).getDescribe().isAccessible();
    }

    private class AddressDisplayExpectation {
        private String metricKey;
        private String objectApiName;
        private String stateFieldApiName;
        private String cityFieldApiName;
        private List<String> excludedFieldApiNames;

        private AddressDisplayExpectation(List<String> values) {
            metricKey = values[0];
            objectApiName = values[1];
            stateFieldApiName = values[2];
            cityFieldApiName = values[3];
            excludedFieldApiNames = new List<String>();
            for (Integer index = 4; index < values.size(); index++) {
                excludedFieldApiNames.add(values[index]);
            }
        }
    }
}
