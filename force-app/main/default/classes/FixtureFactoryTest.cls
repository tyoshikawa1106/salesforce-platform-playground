/**
 * テストデータ fixture 作成基盤の契約をテストします。
 */
@IsTest
private with sharing class FixtureFactoryTest {
    @IsTest
    static void createAccountShouldReturnUnsavedRecord() {
        // 実行
        Account accountRecord;
        Test.startTest();
        accountRecord = FixtureFactory.createAccount('契約取引先');
        Test.stopTest();

        // 検証
        Assert.isNull(
            accountRecord.Id,
            'createAccount should return an unsaved Account.'
        );
        Assert.areEqual(
            '契約取引先',
            accountRecord.Name,
            'createAccount should keep the requested Account name.'
        );
    }

    @IsTest
    static void insertContactShouldLinkToSavedAccount() {
        // 準備
        Account accountRecord = FixtureFactory.insertAccount('責任者取引先');

        // 実行
        Contact contactRecord;
        Test.startTest();
        contactRecord = FixtureFactory.insertContact(
            accountRecord,
            '契約責任者'
        );
        Test.stopTest();

        // 検証
        Assert.isNotNull(
            contactRecord.Id,
            'insertContact should save the Contact.'
        );
        Assert.areEqual(
            accountRecord.Id,
            contactRecord.AccountId,
            'insertContact should link the Contact to the requested Account.'
        );
        Assert.areEqual(
            '契約責任者',
            contactRecord.LastName,
            'insertContact should keep the requested LastName.'
        );
    }

    @IsTest
    static void insertOpportunityLineItemShouldLinkSalesRecords() {
        // 準備
        Account accountRecord = FixtureFactory.insertAccount('商談取引先');
        Opportunity opportunityRecord = FixtureFactory.insertOpportunity(
            accountRecord,
            '契約商談',
            'Prospecting',
            Date.today().addDays(30)
        );
        Product2 productRecord = FixtureFactory.insertProduct('契約商品');
        PricebookEntry pricebookEntryRecord = FixtureFactory.insertPricebookEntry(
            productRecord,
            Test.getStandardPricebookId(),
            100
        );

        // 実行
        OpportunityLineItem lineItemRecord;
        Test.startTest();
        lineItemRecord = FixtureFactory.insertOpportunityLineItem(
            opportunityRecord,
            pricebookEntryRecord,
            1,
            100
        );
        Test.stopTest();

        // 検証
        Assert.isNotNull(
            lineItemRecord.Id,
            'insertOpportunityLineItem should save the OpportunityLineItem.'
        );
        Assert.areEqual(
            opportunityRecord.Id,
            lineItemRecord.OpportunityId,
            'insertOpportunityLineItem should link to the requested Opportunity.'
        );
        Assert.areEqual(
            pricebookEntryRecord.Id,
            lineItemRecord.PricebookEntryId,
            'insertOpportunityLineItem should link to the requested PricebookEntry.'
        );
    }

    @IsTest
    static void insertLeadAndCaseShouldSaveRequiredFields() {
        // 実行
        Lead leadRecord;
        Case caseRecord;
        Test.startTest();
        leadRecord = FixtureFactory.insertLead('契約リード', '契約会社');
        caseRecord = FixtureFactory.insertCase('契約ケース');
        Test.stopTest();

        // 検証
        Assert.isNotNull(leadRecord.Id, 'insertLead should save the Lead.');
        Assert.areEqual(
            '契約リード',
            leadRecord.LastName,
            'insertLead should keep the requested LastName.'
        );
        Assert.areEqual(
            '契約会社',
            leadRecord.Company,
            'insertLead should keep the requested Company.'
        );
        Assert.isNotNull(caseRecord.Id, 'insertCase should save the Case.');
        Assert.areEqual(
            '契約ケース',
            caseRecord.Subject,
            'insertCase should keep the requested Subject.'
        );
    }
}
