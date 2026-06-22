/**
 * Apex テストで再利用するテストデータを作成します。
 */
@IsTest
public with sharing class TestDataFactory {
    /**
     * 既定値を持つ取引先レコードを作成します。
     * @param count 作成する取引先件数
     * @return 作成した取引先レコード
     */
    public static List<Account> createAccounts(Integer count) {
        List<Account> accounts = new List<Account>();
        if (count == null || count <= 0) {
            return accounts;
        }

        for (Integer index = 0; index < count; index++) {
            accounts.add(new Account(Name = 'Test Account ' + index));
        }

        return accounts;
    }

    /**
     * 既定値を持つ取引先レコードを作成して保存します。
     * @param count 保存する取引先件数
     * @return 保存した取引先レコード
     */
    public static List<Account> insertAccounts(Integer count) {
        List<Account> accounts = createAccounts(count);
        insert accounts;
        return accounts;
    }

    /**
     * 指定した名前の未保存取引先を 1 件作成します。
     * @param accountName 使用する取引先名
     * @return 作成した取引先レコード
     */
    public static Account createAccount(String accountName) {
        return new Account(Name = accountName);
    }

    /**
     * 指定した名前の取引先を 1 件作成して保存します。
     * @param accountName 使用する取引先名
     * @return 保存した取引先レコード
     */
    public static Account insertAccount(String accountName) {
        Account accountRecord = createAccount(accountName);
        insert accountRecord;
        return accountRecord;
    }

    /**
     * 指定した取引先に紐づく未保存取引先責任者を 1 件作成します。
     * @param accountRecord 紐づける取引先
     * @param lastName 使用する姓
     * @return 作成した取引先責任者レコード
     */
    public static Contact createContact(
        Account accountRecord,
        String lastName
    ) {
        return new Contact(AccountId = accountRecord.Id, LastName = lastName);
    }

    /**
     * 指定した取引先に紐づく取引先責任者を 1 件作成して保存します。
     * @param accountRecord 紐づける取引先
     * @param lastName 使用する姓
     * @return 保存した取引先責任者レコード
     */
    public static Contact insertContact(
        Account accountRecord,
        String lastName
    ) {
        Contact contactRecord = createContact(accountRecord, lastName);
        insert contactRecord;
        return contactRecord;
    }

    /**
     * 指定した取引先に紐づく未保存商談を 1 件作成します。
     * @param accountRecord 紐づける取引先
     * @param opportunityName 使用する商談名
     * @return 作成した商談レコード
     */
    public static Opportunity createOpportunity(
        Account accountRecord,
        String opportunityName
    ) {
        return new Opportunity(
            AccountId = accountRecord.Id,
            Name = opportunityName,
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30)
        );
    }

    /**
     * 指定した取引先に紐づく商談を 1 件作成して保存します。
     * @param accountRecord 紐づける取引先
     * @param opportunityName 使用する商談名
     * @return 保存した商談レコード
     */
    public static Opportunity insertOpportunity(
        Account accountRecord,
        String opportunityName
    ) {
        Opportunity opportunityRecord = createOpportunity(
            accountRecord,
            opportunityName
        );
        insert opportunityRecord;
        return opportunityRecord;
    }

    /**
     * 未保存商品を 1 件作成します。
     * @param productName 使用する商品名
     * @return 作成した商品レコード
     */
    public static Product2 createProduct(String productName) {
        return new Product2(Name = productName, IsActive = true);
    }

    /**
     * 商品を 1 件作成して保存します。
     * @param productName 使用する商品名
     * @return 保存した商品レコード
     */
    public static Product2 insertProduct(String productName) {
        Product2 productRecord = createProduct(productName);
        insert productRecord;
        return productRecord;
    }

    /**
     * 指定した商品に紐づく未保存価格表エントリを 1 件作成します。
     * @param productRecord 紐づける商品
     * @param pricebook2Id 紐づける価格表 ID
     * @param unitPrice 単価
     * @return 作成した価格表エントリレコード
     */
    public static PricebookEntry createPricebookEntry(
        Product2 productRecord,
        Id pricebook2Id,
        Decimal unitPrice
    ) {
        return new PricebookEntry(
            Pricebook2Id = pricebook2Id,
            Product2Id = productRecord.Id,
            UnitPrice = unitPrice,
            IsActive = true
        );
    }

    /**
     * 指定した商品に紐づく価格表エントリを 1 件作成して保存します。
     * @param productRecord 紐づける商品
     * @param pricebook2Id 紐づける価格表 ID
     * @param unitPrice 単価
     * @return 保存した価格表エントリレコード
     */
    public static PricebookEntry insertPricebookEntry(
        Product2 productRecord,
        Id pricebook2Id,
        Decimal unitPrice
    ) {
        PricebookEntry pricebookEntryRecord = createPricebookEntry(
            productRecord,
            pricebook2Id,
            unitPrice
        );
        insert pricebookEntryRecord;
        return pricebookEntryRecord;
    }

    /**
     * 指定した商談と価格表エントリに紐づく未保存商談商品を 1 件作成します。
     * @param opportunityRecord 紐づける商談
     * @param pricebookEntryRecord 紐づける価格表エントリ
     * @return 作成した商談商品レコード
     */
    public static OpportunityLineItem createOpportunityLineItem(
        Opportunity opportunityRecord,
        PricebookEntry pricebookEntryRecord
    ) {
        return new OpportunityLineItem(
            OpportunityId = opportunityRecord.Id,
            PricebookEntryId = pricebookEntryRecord.Id,
            Quantity = 1,
            UnitPrice = pricebookEntryRecord.UnitPrice
        );
    }

    /**
     * 指定した商談と価格表エントリに紐づく商談商品を 1 件作成して保存します。
     * @param opportunityRecord 紐づける商談
     * @param pricebookEntryRecord 紐づける価格表エントリ
     * @return 保存した商談商品レコード
     */
    public static OpportunityLineItem insertOpportunityLineItem(
        Opportunity opportunityRecord,
        PricebookEntry pricebookEntryRecord
    ) {
        OpportunityLineItem lineItemRecord = createOpportunityLineItem(
            opportunityRecord,
            pricebookEntryRecord
        );
        insert lineItemRecord;
        return lineItemRecord;
    }

    /**
     * 未保存リードを 1 件作成します。
     * @param lastName 使用する姓
     * @param company 使用する会社名
     * @return 作成したリードレコード
     */
    public static Lead createLead(String lastName, String company) {
        return new Lead(LastName = lastName, Company = company);
    }

    /**
     * リードを 1 件作成して保存します。
     * @param lastName 使用する姓
     * @param company 使用する会社名
     * @return 保存したリードレコード
     */
    public static Lead insertLead(String lastName, String company) {
        Lead leadRecord = createLead(lastName, company);
        insert leadRecord;
        return leadRecord;
    }

    /**
     * 未保存ケースを 1 件作成します。
     * @param subject 使用する件名
     * @return 作成したケースレコード
     */
    public static Case createCase(String subject) {
        return new Case(Subject = subject);
    }

    /**
     * ケースを 1 件作成して保存します。
     * @param subject 使用する件名
     * @return 保存したケースレコード
     */
    public static Case insertCase(String subject) {
        Case caseRecord = createCase(subject);
        insert caseRecord;
        return caseRecord;
    }
}