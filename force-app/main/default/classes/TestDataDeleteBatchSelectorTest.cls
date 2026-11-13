/** バッチの対象カーソルと権限照会を検証 */
@IsTest
private with sharing class TestDataDeleteBatchSelectorTest {

    private static TestDataDeleteBatchSelector selector = new TestDataDeleteBatchSelector();
    private static TestDataDeleteBatchService service = new TestDataDeleteBatchService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    private static void verifyEmptyTarget(String objectName) {
        if (!Schema.getGlobalDescribe().containsKey(objectName)) {
            return;
        }
        String filter = service.getRecordFilter(objectName);
        Assert.areEqual(0, selector.getRemaining(objectName, filter), objectName + 'の空状態を照会');
        Database.QueryLocator records = selector.getRecords(objectName, filter);
        Assert.isFalse(records.iterator().hasNext(), objectName + 'の削除対象は空');
    }

    /** 投入対象オブジェクトの取得クエリを検証 */
    @IsTest
    static void validatesQueriesForEveryImportedObject() {

        System.runAs(testUser) {
            Test.startTest();
            verifyEmptyTarget('ContentDocument');
            verifyEmptyTarget('EmailMessage');
            verifyEmptyTarget('Task');
            verifyEmptyTarget('Event');
            verifyEmptyTarget('WorkOrderLineItem');
            verifyEmptyTarget('WorkOrder');
            verifyEmptyTarget('Case');
            verifyEmptyTarget('Entitlement');
            verifyEmptyTarget('ContractLineItem');
            verifyEmptyTarget('ServiceContract');
            verifyEmptyTarget('OrderItem');
            verifyEmptyTarget('Order');
            verifyEmptyTarget('OpportunityContactRole');
            verifyEmptyTarget('OpportunityLineItem');
            verifyEmptyTarget('Opportunity');
            verifyEmptyTarget('Contract');
            verifyEmptyTarget('Asset');
            verifyEmptyTarget('CampaignMember');
            verifyEmptyTarget('Campaign');
            verifyEmptyTarget('Lead');
            verifyEmptyTarget('Contact');
            verifyEmptyTarget('PricebookEntry');
            verifyEmptyTarget('Product2');
            Assert.areEqual(
                0,
                selector.getRemaining('Account', 'IsDeleted = false'),
                '取引先の空状態を確認'
            );
            Test.stopTest();
        }
    }

    /** 保存データなしで実行条件の取得結果を確認 */
    @IsTest
    static void loadsExecutionContext() {
        System.runAs(testUser) {
            Test.startTest();
            List<Organization> organizations = selector.getOrganizations();
            List<UserPermissionAccess> permissions = selector.getPermissions();
            Test.stopTest();
            Assert.areEqual(1, organizations.size(), '実行先の組織情報を一件取得');
            Assert.isNotNull(organizations[0].IsSandbox, 'Sandbox判定を取得');
            Assert.isTrue(String.isNotBlank(organizations[0].OrganizationType), 'Edition判定を取得');
            Assert.areEqual(1, permissions.size(), '実行ユーザーの実効権限を取得');
            Assert.isTrue(permissions[0].PermissionsModifyAllData, '標準システム管理者の実効権限を確認');
        }
    }

    /** ごみ箱を除いた残存レコードを取得 */
    @IsTest
    static void countsOnlyRemainingRecords() {

        System.runAs(testUser) {
            Account account = new Account(Name = '削除済み');
            insert account;
            insert new Account(Name = '残存');
            delete account;
            Test.startTest();
            Integer remaining = selector.getRemaining('Account', 'IsDeleted = false');
            Database.QueryLocator records = selector.getRecords('Account', 'IsDeleted = false');
            Test.stopTest();
            Assert.areEqual(1, remaining, 'ごみ箱を除いた残件数');
            Assert.isTrue(records.iterator().hasNext(), '対象のカーソルを返す');
        }
    }

    /** 標準価格と無効なカスタム価格を削除 */
    @IsTest
    static void deletesStandardAndInactiveCustomPrices() {

        System.runAs(testUser) {
            Product2 product = new Product2(Name = '価格表の削除検証', IsActive = true);
            insert product;
            Id standardId = Test.getStandardPricebookId();
            update new Pricebook2(Id = standardId, IsActive = true);
            insert new PricebookEntry(Pricebook2Id = Test.getStandardPricebookId(), Product2Id = product.Id, UnitPrice = 1200, IsActive = true);
            Pricebook2 custom = new Pricebook2(Name = '無効な価格表も対象', IsActive = false);
            insert custom;
            insert new PricebookEntry(
                Product2Id = product.Id,
                Pricebook2Id = custom.Id,
                UnitPrice = 100,
                IsActive = false
            );
                    TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('PricebookEntry');
            Test.startTest();
            String filter = service.getRecordFilter('PricebookEntry');
            Assert.areEqual(
                2,
                selector.getRemaining('PricebookEntry', filter),
                '標準価格表と無効なカスタム価格表を含める'
            );
            String customFilter = service.getStageRecordFilter(plan);
            List<SObject> customScope = collectScope(selector.getRecords('PricebookEntry', customFilter));
            Assert.areEqual(1, customScope.size(), '最初はカスタム価格だけを選択');
            Database.delete(customScope, AccessLevel.USER_MODE);
            TestDataDeleteBatchWrapper standardPlan = service.createNext(plan);
            String standardFilter = service.getStageRecordFilter(standardPlan);
            List<SObject> standardScope = collectScope(selector.getRecords('PricebookEntry', standardFilter));
            Assert.areEqual(1, standardScope.size(), 'カスタム価格削除後も標準価格を保持');
            Database.delete(standardScope, AccessLevel.USER_MODE);
            Test.stopTest();
            Assert.areEqual(0, selector.getRemaining('PricebookEntry', filter), '参照先のあるエントリを全件削除');
            Assert.areEqual(1, [SELECT COUNT() FROM Product2], '商品は次の段階まで保持');
            Assert.areEqual(1, [SELECT COUNT() FROM Pricebook2 WHERE Id = :custom.Id], '価格表本体は削除しない');
        }

    }

    private static List<SObject> collectScope(Database.QueryLocator locator) {
        Database.QueryLocatorIterator iterator = locator.iterator();
        List<SObject> result = new List<SObject>();
        while (iterator.hasNext()) {
            result.add(iterator.next());
        }
        return result;
    }
    /** 登録済みジョブを実行せず検索条件を確認 */
    @IsTest
    static void queriesRegisteredDeleteJob() {

        System.runAs(testUser) {
            Test.startTest();
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(new TestDataDeleteBatchWrapper()), 200);
            Assert.areEqual(jobId, selector.getJob(jobId)[0].Id, '完了通知用の同じジョブを取得');
            Assert.isTrue(selector.getOtherActiveJobs(jobId).isEmpty(), '自身を重複起動と誤認しない');
            Assert.areEqual(jobId, selector.getOtherActiveJobs(null)[0].Id, '自身の指定がない場合は登録済みジョブを検出');
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

}