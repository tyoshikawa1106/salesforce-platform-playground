/**
 * TestDataFactory テスト
 */
@IsTest
private with sharing class TestDataFactoryTest {

    private static User testUser = TestDataFactory.currentUser();

    @IsTest
    static void createAccountsWhenCountIsPositiveReturnsNamedAccounts() {
        System.runAs(testUser) {
            List<Account> accounts = TestDataFactory.createAccounts(3);

            Assert.areEqual(
                3,
                accounts.size(),
                '取引先は 3 件作成する必要あり'
            );
            Assert.areEqual(
                'Test Account 0',
                accounts[0].Name,
                '先頭の取引先は期待するデフォルト名を使う必要あり'
            );
            Assert.areEqual(
                'Test Account 2',
                accounts[2].Name,
                '最後の取引先は 0 始まりのインデックスを含む必要あり'
            );
        }
    }

    @IsTest
    static void createAccountsWhenCountIsNullOrZeroReturnsEmptyList() {
        System.runAs(testUser) {
            Assert.areEqual(
                0,
                TestDataFactory.createAccounts(null).size(),
                'null 件数は空リストを返す必要あり'
            );
            Assert.areEqual(
                0,
                TestDataFactory.createAccounts(0).size(),
                '0 件数は空リストを返す必要あり'
            );
        }
    }

    @IsTest
    static void insertAccountWhenNameIsProvidedSavesAccount() {
        System.runAs(testUser) {
            Test.startTest();
            Account accountRecord = TestDataFactory.insertAccount(
                'Factory Account'
            );

            Test.stopTest();
            Account savedAccount = [
                SELECT Name
                FROM Account
                WHERE Id = :accountRecord.Id
                LIMIT 1
            ];
            Assert.areEqual(
                'Factory Account',
                savedAccount.Name,
                '作成済み取引先は指定された名前を保つ必要あり'
            );
        }
    }

    @IsTest
    static void createRelatedRecordsWhenParentsAreProvidedPopulatesLookups() {
        System.runAs(testUser) {
            Account accountRecord = TestDataFactory.insertAccount(
                'Factory Parent Account'
            );
            Product2 productRecord = TestDataFactory.insertProduct(
                'Factory Product'
            );
            PricebookEntry pricebookEntryRecord = TestDataFactory.insertPricebookEntry(
                productRecord,
                Test.getStandardPricebookId(),
                1200
            );
            Opportunity opportunityRecord = TestDataFactory.insertOpportunity(
                accountRecord,
                'Factory Opportunity'
            );
            Contact contactRecord = TestDataFactory.createContact(
                accountRecord,
                'Factory Contact'
            );
            Opportunity createdOpportunity = TestDataFactory.createOpportunity(
                accountRecord,
                'Factory Opportunity'
            );
            PricebookEntry createdPricebookEntry = TestDataFactory.createPricebookEntry(
                productRecord,
                Test.getStandardPricebookId(),
                1200
            );
            OpportunityLineItem lineItemRecord = TestDataFactory.createOpportunityLineItem(
                opportunityRecord,
                pricebookEntryRecord
            );

            Assert.areEqual(
                accountRecord.Id,
                contactRecord.AccountId,
                '取引先責任者は指定された取引先を参照する必要あり'
            );
            Assert.areEqual(
                accountRecord.Id,
                createdOpportunity.AccountId,
                '商談は指定された取引先を参照する必要あり'
            );
            Assert.areEqual(
                productRecord.Id,
                createdPricebookEntry.Product2Id,
                '価格表エントリは指定された商品を参照する必要あり'
            );
            Assert.areEqual(
                opportunityRecord.Id,
                lineItemRecord.OpportunityId,
                '商談商品は指定された商談を参照する必要あり'
            );
            Assert.areEqual(
                pricebookEntryRecord.Id,
                lineItemRecord.PricebookEntryId,
                '商談商品は指定された価格表エントリを参照する必要あり'
            );
        }
    }

    @IsTest
    static void createLeadAndCaseWhenRequiredValuesProvidedPopulatesFields() {
        System.runAs(testUser) {
            Lead leadRecord = TestDataFactory.createLead(
                'Factory Lead',
                'Factory Company'
            );
            Case caseRecord = TestDataFactory.createCase('Factory Case');

            Assert.areEqual(
                'Factory Lead',
                leadRecord.LastName,
                'リードは指定された姓を使う必要あり'
            );
            Assert.areEqual(
                'Factory Company',
                leadRecord.Company,
                'リードは指定された会社名を使う必要あり'
            );
            Assert.areEqual(
                'Factory Case',
                caseRecord.Subject,
                'ケースは指定された件名を使う必要あり'
            );
        }
    }
}
