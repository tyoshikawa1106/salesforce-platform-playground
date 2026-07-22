/**
 * Apex テストで再利用するテストデータを作成
 */
@IsTest
public with sharing class TestDataFactory {

    // 取引先データ品質スキャンの権限セットAPI名
    private static final String ACCOUNT_DATA_QUALITY_SCAN_PERMISSION_SET = 'Account_Data_Quality_Scan';

    // 取引先データ品質スキャン用テストユーザーのAlias
    private static final String ACCOUNT_DATA_QUALITY_SCAN_USER_ALIAS = 'dqscan';

    /**
     * TestDataFactory のレコード保存方法
     */
    public enum SaveMode {
        // 作成したレコードを保存して返却
        INSERT_RECORD,
        // 作成したレコードを保存せず返却
        DO_NOT_INSERT
    }

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
     * データ品質スキャン権限を持つテストユーザーを作成
     * @param userMarker テストクラスごとに識別する姓
     */
    public static void createAccountDataQualityScanTestUser(String userMarker) {
        User userRecord = new User();
        userRecord.Alias = ACCOUNT_DATA_QUALITY_SCAN_USER_ALIAS;
        userRecord.Email = 'data-quality-scan@example.invalid';
        userRecord.EmailEncodingKey = 'UTF-8';
        userRecord.LanguageLocaleKey = 'ja';
        userRecord.LastName = userMarker;
        userRecord.LocaleSidKey = 'ja_JP';
        userRecord.ProfileId = UserInfo.getProfileId();
        userRecord.TimeZoneSidKey = 'Asia/Tokyo';
        userRecord.Username =
            'data-quality-scan.' + userMarker.toLowerCase() + '.' + String.valueOf(System.now().getTime()) + '@example.invalid';
        insert userRecord;

        PermissionSet permissionSet = [
            SELECT Id
            FROM PermissionSet
            WHERE Name = :ACCOUNT_DATA_QUALITY_SCAN_PERMISSION_SET
            LIMIT 1
        ];
        insert new PermissionSetAssignment(AssigneeId = userRecord.Id, PermissionSetId = permissionSet.Id);
    }

    /**
     * データ品質スキャン権限を持つテストユーザーを取得
     * @param userMarker テストクラスごとに識別する姓
     * @return 指定したテストユーザー
     */
    public static User getAccountDataQualityScanTestUser(String userMarker) {
        return [
            SELECT Id
            FROM User
            WHERE Alias = :ACCOUNT_DATA_QUALITY_SCAN_USER_ALIAS AND LastName = :userMarker
            LIMIT 1
        ];
    }

    /**
     * 指定した名前の取引先を 1 件作成
     * @param accountName 使用する取引先名
     * @param saveOption 作成した取引先の保存方法
     * @return 作成した取引先レコード
     */
    public static Account createAccount(String accountName, SaveMode saveOption) {
        Account accountRecord = new Account();
        accountRecord.Name = accountName;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert accountRecord;
        }
        return accountRecord;
    }

    /**
     * 指定した取引先に紐づく取引先責任者を 1 件作成
     * @param accountRecord 紐づける取引先
     * @param lastName 使用する姓
     * @param saveOption 作成した取引先責任者の保存方法
     * @return 作成した取引先責任者レコード
     */
    public static Contact createContact(Account accountRecord, String lastName, SaveMode saveOption) {
        Contact contactRecord = new Contact();
        contactRecord.AccountId = accountRecord.Id;
        contactRecord.LastName = lastName;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert contactRecord;
        }
        return contactRecord;
    }

    /**
     * 指定した取引先に紐づく商談を 1 件作成
     * @param accountRecord 紐づける取引先
     * @param opportunityName 使用する商談名
     * @param saveOption 作成した商談の保存方法
     * @return 作成した商談レコード
     */
    public static Opportunity createOpportunity(Account accountRecord, String opportunityName, SaveMode saveOption) {
        Opportunity opportunityRecord = new Opportunity();
        opportunityRecord.AccountId = accountRecord.Id;
        opportunityRecord.Name = opportunityName;
        opportunityRecord.StageName = 'Prospecting';
        opportunityRecord.CloseDate = Date.today().addDays(30);
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert opportunityRecord;
        }
        return opportunityRecord;
    }

    /**
     * 商品を 1 件作成
     * @param productName 使用する商品名
     * @param saveOption 作成した商品の保存方法
     * @return 作成した商品レコード
     */
    public static Product2 createProduct(String productName, SaveMode saveOption) {
        Product2 productRecord = new Product2();
        productRecord.Name = productName;
        productRecord.IsActive = true;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert productRecord;
        }
        return productRecord;
    }

    /**
     * 指定した商品に紐づく価格表エントリを 1 件作成
     * @param productRecord 紐づける商品
     * @param saveOption 作成した価格表エントリの保存方法
     * @return 作成した価格表エントリレコード
     */
    public static PricebookEntry createPricebookEntry(Product2 productRecord, SaveMode saveOption) {
        PricebookEntry pricebookEntryRecord = new PricebookEntry();
        pricebookEntryRecord.Pricebook2Id = Test.getStandardPricebookId();
        pricebookEntryRecord.Product2Id = productRecord.Id;
        pricebookEntryRecord.UnitPrice = 1200;
        pricebookEntryRecord.IsActive = true;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert pricebookEntryRecord;
        }
        return pricebookEntryRecord;
    }

    /**
     * 指定した商談と価格表エントリに紐づく商談商品を 1 件作成
     * @param opportunityRecord 紐づける商談
     * @param pricebookEntryRecord 紐づける価格表エントリ
     * @param saveOption 作成した商談商品の保存方法
     * @return 作成した商談商品レコード
     */
    public static OpportunityLineItem createOpportunityLineItem(Opportunity opportunityRecord, PricebookEntry pricebookEntryRecord, SaveMode saveOption) {
        OpportunityLineItem lineItemRecord = new OpportunityLineItem();
        lineItemRecord.OpportunityId = opportunityRecord.Id;
        lineItemRecord.PricebookEntryId = pricebookEntryRecord.Id;
        lineItemRecord.Quantity = 1;
        lineItemRecord.UnitPrice = pricebookEntryRecord.UnitPrice;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert lineItemRecord;
        }
        return lineItemRecord;
    }

    /**
     * リードを 1 件作成
     * @param lastName 使用する姓
     * @param company 使用する会社名
     * @param saveOption 作成したリードの保存方法
     * @return 作成したリードレコード
     */
    public static Lead createLead(String lastName, String company, SaveMode saveOption) {
        Lead leadRecord = new Lead();
        leadRecord.LastName = lastName;
        leadRecord.Company = company;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert leadRecord;
        }
        return leadRecord;
    }

    /**
     * ケースを 1 件作成
     * @param subject 使用する件名
     * @param saveOption 作成したケースの保存方法
     * @return 作成したケースレコード
     */
    public static Case createCase(String subject, SaveMode saveOption) {
        Case caseRecord = new Case();
        caseRecord.Subject = subject;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert caseRecord;
        }
        return caseRecord;
    }

    /**
     * 指定した状態と対象件数のデータ品質スキャンを1件作成
     * @param status スキャンの状態値
     * @param totalCount 対象取引先の総件数
     * @param saveOption 作成したスキャンの保存方法
     * @return 作成したデータ品質スキャンレコード
     */
    public static DataQualityScan__c createDataQualityScan(String status, Integer totalCount, SaveMode saveOption) {
        DataQualityScan__c scanRecord = new DataQualityScan__c();
        scanRecord.Status__c = status;
        scanRecord.Target_Object__c = 'Account';
        scanRecord.Total_Count__c = totalCount;
        scanRecord.Processed_Count__c = 0;
        scanRecord.Missing_Phone_Count__c = 0;
        scanRecord.Missing_Industry_Count__c = 0;
        scanRecord.Missing_Address_Count__c = 0;
        scanRecord.Missing_Website_Count__c = 0;
        scanRecord.Missing_Account_Number_Count__c = 0;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = UserInfo.getUserId();
        Boolean isActive = status == AccountDataQualityScanService.STATUS_PENDING || status == AccountDataQualityScanService.STATUS_RUNNING;
        scanRecord.Active_Key__c = isActive ? AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY : null;
        if (saveOption == SaveMode.INSERT_RECORD) {
            insert scanRecord;
        }
        return scanRecord;
    }
}
