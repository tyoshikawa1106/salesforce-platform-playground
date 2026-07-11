/**
 * Apex テストで再利用するテストデータを作成
 */
@IsTest
@SuppressWarnings('PMD.AvoidBooleanMethodParameters')
public with sharing class TestDataFactory {

    /**
     * System.runAs に渡すテスト実行ユーザーの参照を作成
     * @return 現在ログインユーザーの Id だけを持つ User レコード
     */
    public static User getTestUser() {
        User userRecord = new User();
        userRecord.Id = UserInfo.getUserId();
        return userRecord;
    }

    /**
     * 指定した名前の取引先を 1 件作成
     * @param accountName 使用する取引先名
     * @param isInsert true の場合は作成した取引先を保存
     * @return 作成した取引先レコード
     */
    public static Account createAccount(String accountName, Boolean isInsert) {
        Account accountRecord = new Account();
        accountRecord.Name = accountName;
        if (isInsert == true) {
            insert accountRecord;
        }
        return accountRecord;
    }

    /**
     * 指定した取引先に紐づく取引先責任者を 1 件作成
     * @param accountRecord 紐づける取引先
     * @param lastName 使用する姓
     * @param isInsert true の場合は作成した取引先責任者を保存
     * @return 作成した取引先責任者レコード
     */
    public static Contact createContact(Account accountRecord, String lastName, Boolean isInsert) {
        Contact contactRecord = new Contact();
        contactRecord.AccountId = accountRecord.Id;
        contactRecord.LastName = lastName;
        if (isInsert == true) {
            insert contactRecord;
        }
        return contactRecord;
    }

    /**
     * 指定した取引先に紐づく商談を 1 件作成
     * @param accountRecord 紐づける取引先
     * @param opportunityName 使用する商談名
     * @param isInsert true の場合は作成した商談を保存
     * @return 作成した商談レコード
     */
    public static Opportunity createOpportunity(Account accountRecord, String opportunityName, Boolean isInsert) {
        Opportunity opportunityRecord = new Opportunity();
        opportunityRecord.AccountId = accountRecord.Id;
        opportunityRecord.Name = opportunityName;
        opportunityRecord.StageName = 'Prospecting';
        opportunityRecord.CloseDate = Date.today().addDays(30);
        if (isInsert == true) {
            insert opportunityRecord;
        }
        return opportunityRecord;
    }

    /**
     * 商品を 1 件作成
     * @param productName 使用する商品名
     * @param isInsert true の場合は作成した商品を保存
     * @return 作成した商品レコード
     */
    public static Product2 createProduct(String productName, Boolean isInsert) {
        Product2 productRecord = new Product2();
        productRecord.Name = productName;
        productRecord.IsActive = true;
        if (isInsert == true) {
            insert productRecord;
        }
        return productRecord;
    }

    /**
     * 指定した商品に紐づく価格表エントリを 1 件作成
     * @param productRecord 紐づける商品
     * @param isInsert true の場合は作成した価格表エントリを保存
     * @return 作成した価格表エントリレコード
     */
    public static PricebookEntry createPricebookEntry(Product2 productRecord, Boolean isInsert) {
        PricebookEntry pricebookEntryRecord = new PricebookEntry();
        pricebookEntryRecord.Pricebook2Id = Test.getStandardPricebookId();
        pricebookEntryRecord.Product2Id = productRecord.Id;
        pricebookEntryRecord.UnitPrice = 1200;
        pricebookEntryRecord.IsActive = true;
        if (isInsert == true) {
            insert pricebookEntryRecord;
        }
        return pricebookEntryRecord;
    }

    /**
     * 指定した商談と価格表エントリに紐づく商談商品を 1 件作成
     * @param opportunityRecord 紐づける商談
     * @param pricebookEntryRecord 紐づける価格表エントリ
     * @param isInsert true の場合は作成した商談商品を保存
     * @return 作成した商談商品レコード
     */
    public static OpportunityLineItem createOpportunityLineItem(Opportunity opportunityRecord, PricebookEntry pricebookEntryRecord, Boolean isInsert) {
        OpportunityLineItem lineItemRecord = new OpportunityLineItem();
        lineItemRecord.OpportunityId = opportunityRecord.Id;
        lineItemRecord.PricebookEntryId = pricebookEntryRecord.Id;
        lineItemRecord.Quantity = 1;
        lineItemRecord.UnitPrice = pricebookEntryRecord.UnitPrice;
        if (isInsert == true) {
            insert lineItemRecord;
        }
        return lineItemRecord;
    }

    /**
     * リードを 1 件作成
     * @param lastName 使用する姓
     * @param company 使用する会社名
     * @param isInsert true の場合は作成したリードを保存
     * @return 作成したリードレコード
     */
    public static Lead createLead(String lastName, String company, Boolean isInsert) {
        Lead leadRecord = new Lead();
        leadRecord.LastName = lastName;
        leadRecord.Company = company;
        if (isInsert == true) {
            insert leadRecord;
        }
        return leadRecord;
    }

    /**
     * ケースを 1 件作成
     * @param subject 使用する件名
     * @param isInsert true の場合は作成したケースを保存
     * @return 作成したケースレコード
     */
    public static Case createCase(String subject, Boolean isInsert) {
        Case caseRecord = new Case();
        caseRecord.Subject = subject;
        if (isInsert == true) {
            insert caseRecord;
        }
        return caseRecord;
    }
}
