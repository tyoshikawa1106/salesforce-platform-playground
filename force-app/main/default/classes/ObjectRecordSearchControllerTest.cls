/**
 * 汎用レコード検索画面の Apex 入口をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchControllerTest {
    private static User testUser = TestDataFactory.currentUser();

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = TestDataFactory.createAccounts(3);
        accounts[0].Name = '検索対象 Alpha';
        accounts[0].Industry = 'Technology';
        accounts[0].Type = 'Prospect';
        accounts[0].BillingState = '東京都';
        accounts[0].BillingCity = '千代田区';
        accounts[1].Name = '検索対象 Beta';
        accounts[2].Name = '削除対象 Gamma';
        insert accounts;
    }

    @IsTest
    static void shouldReturnObjectConfigForMetricKey() {
        ObjectRecordSearchConfigWrapper config;

        System.runAs(testUser) {
            Test.startTest();
            config = ObjectRecordSearchController.getObjectConfig('accounts');
            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            config.metricKey,
            'Config should keep the metric key.'
        );
        Assert.areEqual(
            'Account',
            config.objectApiName,
            'Account metric should resolve to Account.'
        );
        Assert.areEqual(
            'Name',
            config.nameFieldApiName,
            'Account list should use the Name field.'
        );
        Assert.isTrue(
            config.createable,
            'Account config should expose object create permission.'
        );
        Assert.isTrue(
            config.updateable,
            'Account config should expose object update permission.'
        );
        Assert.isTrue(
            config.nameFieldCreateable,
            'Account config should expose Name create permission.'
        );
        Assert.isTrue(
            config.nameFieldUpdateable,
            'Account config should expose Name update permission.'
        );
        Assert.isTrue(
            config.displayFields.size() > 0,
            'Account config should expose fixed seed/import display fields.'
        );
        Map<String, ObjectRecordSearchFieldWrapper> displayFieldsByApiName = new Map<String, ObjectRecordSearchFieldWrapper>();
        for (
            ObjectRecordSearchFieldWrapper displayField : config.displayFields
        ) {
            displayFieldsByApiName.put(displayField.apiName, displayField);
        }
        Assert.isTrue(
            displayFieldsByApiName.containsKey('AccountNumber'),
            'Account display fields should include AccountNumber.'
        );
        Assert.isTrue(
            displayFieldsByApiName.containsKey('Industry'),
            'Account display fields should include Industry.'
        );
        Assert.isTrue(
            displayFieldsByApiName.containsKey('BillingState'),
            'Account display fields should include BillingState.'
        );
        Assert.isTrue(
            displayFieldsByApiName.containsKey('BillingCity'),
            'Account display fields should include BillingCity.'
        );
        Assert.isFalse(
            displayFieldsByApiName.containsKey('BillingCountry'),
            'Account display fields should not include BillingCountry.'
        );
        Assert.areEqual(
            'text',
            displayFieldsByApiName.get('Industry').dataType,
            'Picklist display fields should use the text datatable type.'
        );
        Assert.areEqual(
            'phone',
            displayFieldsByApiName.get('Phone').dataType,
            'Phone display fields should use the phone datatable type.'
        );
        Assert.areEqual(
            'url',
            displayFieldsByApiName.get('Website').dataType,
            'URL display fields should use the url datatable type.'
        );
    }

    @IsTest
    static void shouldSearchRecordsByNameField() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            'Alpha'
        );
        request.pageNumber = 1;
        ObjectRecordSearchResultWrapper result;

        System.runAs(testUser) {
            Test.startTest();
            result = ObjectRecordSearchController.searchRecords(request);
            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.records.size(),
            'Search should return matching records only.'
        );
        Assert.areEqual(
            '検索対象 Alpha',
            result.records[0].name,
            'Name field should be mapped to the row label.'
        );
        Assert.isTrue(
            result.records[0].recordUrl.contains('/lightning/r/Account/'),
            'Rows should include a standard record URL.'
        );
        Assert.areEqual(
            'Technology',
            result.records[0].fieldValues.get('Industry'),
            'Rows should expose fixed seed/import fields.'
        );
        Assert.areEqual(
            'Prospect',
            result.records[0].fieldValues.get('Type'),
            'Rows should include Account Type from the import plan.'
        );
        Assert.areEqual(
            '東京都',
            result.records[0].fieldValues.get('BillingState'),
            'Rows should expose Account billing state as prefecture.'
        );
        Assert.areEqual(
            '千代田区',
            result.records[0].fieldValues.get('BillingCity'),
            'Rows should expose Account billing city.'
        );
    }

    @IsTest
    static void shouldReturnRowsWhenSearchTermIsBlank() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            ' '
        );
        ObjectRecordSearchResultWrapper result;

        System.runAs(testUser) {
            Test.startTest();
            result = ObjectRecordSearchController.searchRecords(request);
            Test.stopTest();
        }

        Assert.areEqual(
            3,
            result.records.size(),
            'Blank searches should return all available Account rows.'
        );
        Assert.areEqual(
            50,
            result.pageSize,
            'Search result should expose the page size.'
        );
        Assert.areEqual(
            1,
            result.pageNumber,
            'Search result should default the page number to the first page.'
        );
    }

    @IsTest
    static void shouldReturnEmptyDeleteResultWhenRecordIdsAreNull() {
        ObjectRecordSearchDeleteWrapper result;

        System.runAs(testUser) {
            Test.startTest();
            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                null
            );
            Test.stopTest();
        }

        Assert.areEqual(
            0,
            result.requestedCount,
            'Null delete requests should count zero requested records.'
        );
        Assert.areEqual(
            0,
            result.deletedCount,
            'Null delete requests should not delete records.'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            'Null delete requests should not return errors.'
        );
    }

    @IsTest
    static void shouldReturnEmptyDeleteResultWhenRecordIdsAreEmpty() {
        ObjectRecordSearchDeleteWrapper result;

        System.runAs(testUser) {
            Test.startTest();
            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                new List<Id>()
            );
            Test.stopTest();
        }

        Assert.areEqual(
            0,
            result.requestedCount,
            'Empty delete requests should count zero requested records.'
        );
        Assert.areEqual(
            0,
            result.deletedCount,
            'Empty delete requests should not delete records.'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            'Empty delete requests should not return errors.'
        );
    }

    @IsTest
    static void shouldThrowUserFacingErrorWhenMetricKeyIsUnsupported() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'unknown',
            null
        );
        request.pageNumber = 1;

        System.runAs(testUser) {
            Test.startTest();
            try {
                ObjectRecordSearchController.searchRecords(request);
                Assert.fail('Unsupported metric keys should throw.');
            } catch (AuraHandledException error) {
                Assert.isNotNull(
                    error,
                    'Unsupported metric keys should be wrapped for LWC.'
                );
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void shouldThrowUserFacingErrorWhenPageTokenIsInvalid() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            null
        );
        request.pageToken = 'not-json';

        System.runAs(testUser) {
            Test.startTest();
            try {
                ObjectRecordSearchController.searchRecords(request);
                Assert.fail('Invalid page tokens should throw.');
            } catch (AuraHandledException error) {
                Assert.isNotNull(
                    error,
                    'Invalid page tokens should be wrapped for LWC.'
                );
            }
            Test.stopTest();
        }
    }

    @IsTest
    static void shouldDeleteSelectedRecords() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = '削除対象 Gamma'
            LIMIT 1
        ];

        ObjectRecordSearchDeleteWrapper result;
        System.runAs(testUser) {
            Test.startTest();
            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                new List<Id>{ target.Id }
            );
            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.requestedCount,
            'Delete result should include the requested count.'
        );
        Assert.areEqual(
            1,
            result.deletedCount,
            'Delete result should include the deleted count.'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            'Successful deletes should not return errors.'
        );
        Assert.areEqual(
            0,
            [
                SELECT COUNT()
                FROM Account
                WHERE Id = :target.Id AND IsDeleted = FALSE
                ALL ROWS
            ],
            'Deleted record should no longer be active.'
        );
    }

    private static ObjectRecordSearchRequestWrapper createSearchRequest(
        String metricKey,
        String searchTerm
    ) {
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }
}