@IsTest
private with sharing class TestDataFactoryTest {
    @IsTest
    static void createAccountsWhenCountIsPositiveReturnsNamedAccounts() {
        System.runAs(TestDataFactory.currentUser()) {
            List<Account> accounts = TestDataFactory.createAccounts(3);

            Assert.areEqual(
                3,
                accounts.size(),
                'Three Accounts should be created.'
            );
            Assert.areEqual(
                'Test Account 0',
                accounts[0].Name,
                'The first Account should use the expected default name.'
            );
            Assert.areEqual(
                'Test Account 2',
                accounts[2].Name,
                'The last Account should include the zero-based index.'
            );
        }
    }

    @IsTest
    static void createAccountsWhenCountIsNullOrZeroReturnsEmptyList() {
        System.runAs(TestDataFactory.currentUser()) {
            Assert.areEqual(
                0,
                TestDataFactory.createAccounts(null).size(),
                'Null count should return an empty list.'
            );
            Assert.areEqual(
                0,
                TestDataFactory.createAccounts(0).size(),
                'Zero count should return an empty list.'
            );
        }
    }

    @IsTest
    static void insertAccountWhenNameIsProvidedSavesAccount() {
        System.runAs(TestDataFactory.currentUser()) {
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
                'Inserted Account should keep the requested name.'
            );
        }
    }

    @IsTest
    static void createRelatedRecordsWhenParentsAreProvidedPopulatesLookups() {
        System.runAs(TestDataFactory.currentUser()) {
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
                'Contact should reference the provided Account.'
            );
            Assert.areEqual(
                accountRecord.Id,
                createdOpportunity.AccountId,
                'Opportunity should reference the provided Account.'
            );
            Assert.areEqual(
                productRecord.Id,
                createdPricebookEntry.Product2Id,
                'PricebookEntry should reference the provided Product.'
            );
            Assert.areEqual(
                opportunityRecord.Id,
                lineItemRecord.OpportunityId,
                'OpportunityLineItem should reference the provided Opportunity.'
            );
            Assert.areEqual(
                pricebookEntryRecord.Id,
                lineItemRecord.PricebookEntryId,
                'OpportunityLineItem should reference the provided PricebookEntry.'
            );
        }
    }

    @IsTest
    static void createLeadAndCaseWhenRequiredValuesProvidedPopulatesFields() {
        System.runAs(TestDataFactory.currentUser()) {
            Lead leadRecord = TestDataFactory.createLead(
                'Factory Lead',
                'Factory Company'
            );
            Case caseRecord = TestDataFactory.createCase('Factory Case');

            Assert.areEqual(
                'Factory Lead',
                leadRecord.LastName,
                'Lead should use the requested last name.'
            );
            Assert.areEqual(
                'Factory Company',
                leadRecord.Company,
                'Lead should use the requested company.'
            );
            Assert.areEqual(
                'Factory Case',
                caseRecord.Subject,
                'Case should use the requested subject.'
            );
        }
    }
}
