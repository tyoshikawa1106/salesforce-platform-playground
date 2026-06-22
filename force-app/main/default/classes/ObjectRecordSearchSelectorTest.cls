/**
 * 汎用レコード検索 Selector の検索・削除条件を直接テストします。
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = TestDataFactory.createAccounts(4);
        accounts[0].Name = 'Selector Alpha';
        accounts[1].Name = 'Selector Beta';
        accounts[2].Name = 'Selector Delete One';
        accounts[3].Name = 'Selector Delete Two';
        insert accounts;
    }

    @IsTest
    static void searchRecordsShouldFilterByBoundNameTerm() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = selector.searchRecords('accounts', ' Alpha ');
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
            200,
            result.limitSize,
            'Selector result should expose the configured row limit.'
        );
    }

    @IsTest
    static void searchRecordsShouldReturnRowsWhenSearchTermIsBlank() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        ObjectRecordSearchController.ObjectRecordSearchResult result;

        System.runAs(getCurrentUser()) {
            Test.startTest();
            result = selector.searchRecords('accounts', ' ');
            Test.stopTest();
        }

        Assert.areEqual(
            4,
            result.records.size(),
            'Blank selector searches should return all visible setup Accounts.'
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
}
