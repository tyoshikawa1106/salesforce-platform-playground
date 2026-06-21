/**
 * 汎用レコード検索画面の Apex 入口をテストします。
 */
@IsTest
private with sharing class ObjectRecordSearchControllerTest {
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = TestDataFactory.createAccounts(3);
        accounts[0].Name = '検索対象 Alpha';
        accounts[1].Name = '検索対象 Beta';
        accounts[2].Name = '削除対象 Gamma';
        insert accounts;
    }

    @IsTest
    static void shouldReturnObjectConfigForMetricKey() {
        ObjectRecordSearchController.ObjectRecordSearchConfig config;

        System.runAs(getCurrentUser()) {
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
    }

    @IsTest
    static void shouldSearchRecordsByNameField() {
        ObjectRecordSearchController.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = ObjectRecordSearchController.searchRecords(
                'accounts',
                'Alpha'
            );
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
    }

    @IsTest
    static void shouldReturnRowsWhenSearchTermIsBlank() {
        ObjectRecordSearchController.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = ObjectRecordSearchController.searchRecords(
                'accounts',
                ' '
            );
            Test.stopTest();
        }

        Assert.areEqual(
            3,
            result.records.size(),
            'Blank searches should return all available Account rows.'
        );
        Assert.areEqual(
            200,
            result.limitSize,
            'Search result should expose the Apex row limit.'
        );
    }

    @IsTest
    static void shouldReturnEmptyDeleteResultWhenRecordIdsAreNull() {
        ObjectRecordSearchController.ObjectRecordDeleteResult result;

        System.runAs(getCurrentUser()) {
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
        ObjectRecordSearchController.ObjectRecordDeleteResult result;

        System.runAs(getCurrentUser()) {
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
        System.runAs(getCurrentUser()) {
            Test.startTest();
            try {
                ObjectRecordSearchController.searchRecords('unknown', null);
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
    static void shouldDeleteSelectedRecords() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = '削除対象 Gamma'
            LIMIT 1
        ];

        ObjectRecordSearchController.ObjectRecordDeleteResult result;
        System.runAs(getCurrentUser()) {
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

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
