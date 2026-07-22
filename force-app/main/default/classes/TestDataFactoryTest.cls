/**
 * TestDataFactory テスト
 */
@IsTest
private with sharing class TestDataFactoryTest {

    private static final String DATA_QUALITY_SCAN_TEST_USER_MARKER = 'DQScanFactory';
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * データ品質スキャン用テストデータの作成権限を割り当て
     */
    @TestSetup
    static void setupPermission() {
        TestDataFactory.createAccountDataQualityScanTestUser(DATA_QUALITY_SCAN_TEST_USER_MARKER);
    }

    /**
     * テスト実行ユーザーとして現在ログインユーザーを参照
     */
    @IsTest
    static void getTestUserReturnsCurrentLoginUser() {

        System.runAs(testUser) {
            Test.startTest();

            User actual = TestDataFactory.getTestUser();

            Test.stopTest();
            Assert.areEqual(
                UserInfo.getUserId(),
                actual.Id,
                'テスト実行ユーザーは現在ログインユーザーを参照する必要あり'
            );
        }

    }

    /**
     * 保存モード指定で取引先の保存有無を切り替え
     */
    @IsTest
    static void createAccountWhenInsertFlagProvidedControlsDml() {

        System.runAs(testUser) {
            Test.startTest();

            Account unsavedAccount = TestDataFactory.createAccount('Factory Account Draft', TestDataFactory.SaveMode.DO_NOT_INSERT);
            Account savedAccount = TestDataFactory.createAccount('Factory Account', TestDataFactory.SaveMode.INSERT_RECORD);

            Test.stopTest();
            Account queriedAccount = [
                SELECT Name
                FROM Account
                WHERE Id = :savedAccount.Id
                LIMIT 1
            ];
            Assert.isNull(
                unsavedAccount.Id,
                '未保存指定の取引先は Id を持たない必要あり'
            );
            Assert.isNotNull(
                savedAccount.Id,
                '保存指定の取引先は Id を持つ必要あり'
            );
            Assert.areEqual(
                'Factory Account',
                queriedAccount.Name,
                '作成済み取引先は指定された名前を保つ必要あり'
            );
        }

    }

    /**
     * 親レコードを参照する関連テストデータを作成
     */
    @IsTest
    static void createRelatedRecordsWhenParentsAreProvidedPopulatesLookups() {

        System.runAs(testUser) {
            Test.startTest();

            Account accountRecord = TestDataFactory.createAccount('Factory Parent Account', TestDataFactory.SaveMode.INSERT_RECORD);
            Product2 productRecord = TestDataFactory.createProduct('Factory Product', TestDataFactory.SaveMode.INSERT_RECORD);
            PricebookEntry pricebookEntryRecord = TestDataFactory.createPricebookEntry(productRecord, TestDataFactory.SaveMode.INSERT_RECORD);
            Opportunity opportunityRecord = TestDataFactory.createOpportunity(
                accountRecord,
                'Factory Opportunity', TestDataFactory.SaveMode.INSERT_RECORD
            );
            Contact unsavedContact = TestDataFactory.createContact(
                accountRecord,
                'Factory Contact', TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            Contact savedContact = TestDataFactory.createContact(
                accountRecord,
                'Factory Contact Saved', TestDataFactory.SaveMode.INSERT_RECORD
            );
            Opportunity unsavedOpportunity = TestDataFactory.createOpportunity(
                accountRecord,
                'Factory Opportunity', TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            PricebookEntry unsavedPricebookEntry = TestDataFactory.createPricebookEntry(productRecord, TestDataFactory.SaveMode.DO_NOT_INSERT);
            OpportunityLineItem unsavedLineItem = TestDataFactory.createOpportunityLineItem(
                opportunityRecord,
                pricebookEntryRecord, TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            OpportunityLineItem savedLineItem = TestDataFactory.createOpportunityLineItem(
                opportunityRecord,
                pricebookEntryRecord, TestDataFactory.SaveMode.INSERT_RECORD
            );

            Test.stopTest();
            Assert.areEqual(
                accountRecord.Id,
                unsavedContact.AccountId,
                '取引先責任者は指定された取引先を参照する必要あり'
            );
            Assert.areEqual(
                accountRecord.Id,
                unsavedOpportunity.AccountId,
                '商談は指定された取引先を参照する必要あり'
            );
            Assert.areEqual(
                productRecord.Id,
                unsavedPricebookEntry.Product2Id,
                '価格表エントリは指定された商品を参照する必要あり'
            );
            Assert.areEqual(
                opportunityRecord.Id,
                unsavedLineItem.OpportunityId,
                '商談商品は指定された商談を参照する必要あり'
            );
            Assert.areEqual(
                pricebookEntryRecord.Id,
                unsavedLineItem.PricebookEntryId,
                '商談商品は指定された価格表エントリを参照する必要あり'
            );
            Assert.isNull(
                unsavedContact.Id,
                '未保存指定の取引先責任者は Id を持たない必要あり'
            );
            Assert.isNotNull(
                savedContact.Id,
                '保存指定の取引先責任者は Id を持つ必要あり'
            );
            Assert.isNull(
                unsavedOpportunity.Id,
                '未保存指定の商談は Id を持たない必要あり'
            );
            Assert.isNotNull(
                opportunityRecord.Id,
                '保存指定の商談は Id を持つ必要あり'
            );
            Assert.isNull(
                unsavedPricebookEntry.Id,
                '未保存指定の価格表エントリは Id を持たない必要あり'
            );
            Assert.isNotNull(
                pricebookEntryRecord.Id,
                '保存指定の価格表エントリは Id を持つ必要あり'
            );
            Assert.isNull(
                unsavedLineItem.Id,
                '未保存指定の商談商品は Id を持たない必要あり'
            );
            Assert.isNotNull(
                savedLineItem.Id,
                '保存指定の商談商品は Id を持つ必要あり'
            );
        }

    }

    /**
     * 必須値からリードとケースのテストデータを作成
     */
    @IsTest
    static void createLeadAndCaseWhenRequiredValuesProvidedPopulatesFields() {

        System.runAs(testUser) {
            Test.startTest();

            Lead unsavedLead = TestDataFactory.createLead(
                'Factory Lead',
                'Factory Company', TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            Lead savedLead = TestDataFactory.createLead('Factory Lead Saved', 'Factory Company', TestDataFactory.SaveMode.INSERT_RECORD);
            Case unsavedCase = TestDataFactory.createCase('Factory Case', TestDataFactory.SaveMode.DO_NOT_INSERT);
            Case savedCase = TestDataFactory.createCase('Factory Case Saved', TestDataFactory.SaveMode.INSERT_RECORD);

            Test.stopTest();
            Assert.areEqual(
                'Factory Lead',
                unsavedLead.LastName,
                'リードは指定された姓を使う必要あり'
            );
            Assert.areEqual(
                'Factory Company',
                unsavedLead.Company,
                'リードは指定された会社名を使う必要あり'
            );
            Assert.areEqual(
                'Factory Case',
                unsavedCase.Subject,
                'ケースは指定された件名を使う必要あり'
            );
            Assert.isNull(
                unsavedLead.Id,
                '未保存指定のリードは Id を持たない必要あり'
            );
            Assert.isNotNull(
                savedLead.Id,
                '保存指定のリードは Id を持つ必要あり'
            );
            Assert.isNull(
                unsavedCase.Id,
                '未保存指定のケースは Id を持たない必要あり'
            );
            Assert.isNotNull(
                savedCase.Id,
                '保存指定のケースは Id を持つ必要あり'
            );
        }

    }

    /**
     * 状態と対象件数からデータ品質スキャンの保存有無を切り替え
     */
    @IsTest
    static void createDataQualityScanWhenSaveModeProvidedControlsDml() {
        User dataQualityScanTestUser = TestDataFactory.getAccountDataQualityScanTestUser(
            DATA_QUALITY_SCAN_TEST_USER_MARKER
        );
        DataQualityScan__c unsavedScan;
        DataQualityScan__c savedScan;

        System.runAs(dataQualityScanTestUser) {
            Test.startTest();

            unsavedScan = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_COMPLETED,
                10,
                TestDataFactory.SaveMode.DO_NOT_INSERT
            );
            savedScan = TestDataFactory.createDataQualityScan(
                AccountDataQualityScanService.STATUS_PENDING,
                20,
                TestDataFactory.SaveMode.INSERT_RECORD
            );

            Test.stopTest();
        }

        Assert.isNull(unsavedScan.Id, '未保存指定のスキャンはIDを持たない必要あり');
        Assert.isNotNull(savedScan.Id, '保存指定のスキャンはIDを持つ必要あり');
        Assert.areEqual(20, savedScan.Total_Count__c, '指定した対象総件数を保持する必要あり');
        Assert.areEqual(
            AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY,
            savedScan.Active_Key__c,
            '待機中スキャンは重複防止キーを保持する必要あり'
        );
    }
}
