/** バッチの対象カーソルと権限照会を検証 */
@IsTest
private with sharing class TestDataDeleteBatchSelectorTest {
    private static void verifyEmptyTarget(String objectName) {
        if (!Schema.getGlobalDescribe().containsKey(objectName)) {
            return;
        }
        TestDataDeleteBatchSelector selector = new TestDataDeleteBatchSelector();
        TestDataDeleteBatchService service = new TestDataDeleteBatchService();
        String filter = service.getRecordFilter(objectName);
        Assert.areEqual(0, selector.getRemaining(objectName, filter), objectName + 'の空状態を照会');
        Database.QueryLocator records = selector.getRecords(objectName, filter);
        Assert.isFalse(records.iterator().hasNext(), objectName + 'の削除対象は空');
    }

    @IsTest
    static void validatesQueriesForEveryImportedObject() {
        System.runAs(TestDataFactory.getTestUser()) {
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
                new TestDataDeleteBatchSelector().getRemaining('Account', 'IsDeleted = false'),
                '取引先の空状態を確認'
            );
            Test.stopTest();
        }
    }
    @IsTest
    static void countsOnlyRemainingRecords() {
        System.runAs(TestDataFactory.getTestUser()) {
            Account account = TestDataFactory.createAccount('削除済み', TestDataFactory.SaveMode.INSERT_RECORD);
            TestDataFactory.createAccount('残存', TestDataFactory.SaveMode.INSERT_RECORD);
            delete account;
            Test.startTest();
            TestDataDeleteBatchSelector selector = new TestDataDeleteBatchSelector();
            Integer remaining = selector.getRemaining('Account', 'IsDeleted = false');
            Database.QueryLocator records = selector.getRecords('Account', 'IsDeleted = false');
            List<UserPermissionAccess> permissions = selector.getPermissions();
            Test.stopTest();
            Assert.areEqual(1, remaining, 'ごみ箱を除いた残件数');
            Assert.isTrue(records.iterator().hasNext(), '対象のカーソルを返す');
            Assert.areEqual(1, permissions.size(), '実効権限を取得');
        }
    }

    @IsTest
    static void deletesStandardAndInactiveCustomPrices() {
        System.runAs(TestDataFactory.getTestUser()) {
            Product2 product = TestDataFactory.createProduct(
                '価格表の削除検証',
                TestDataFactory.SaveMode.INSERT_RECORD
            );
            Id standardId = Test.getStandardPricebookId();
            update new Pricebook2(Id = standardId, IsActive = true);
            TestDataFactory.createPricebookEntry(product, TestDataFactory.SaveMode.INSERT_RECORD);
            Pricebook2 custom = new Pricebook2(Name = '無効な価格表も対象', IsActive = false);
            insert custom;
            insert new PricebookEntry(
                Product2Id = product.Id,
                Pricebook2Id = custom.Id,
                UnitPrice = 100,
                IsActive = false
            );
            TestDataDeleteBatchService service = new TestDataDeleteBatchService();
            TestDataDeleteBatchSelector selector = new TestDataDeleteBatchSelector();
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
            new TestDataDeleteBatch(plan).execute(null, customScope);
            TestDataDeleteBatchWrapper standardPlan = service.createNext(plan);
            String standardFilter = service.getStageRecordFilter(standardPlan);
            List<SObject> standardScope = collectScope(selector.getRecords('PricebookEntry', standardFilter));
            Assert.areEqual(1, standardScope.size(), 'カスタム価格削除後も標準価格を保持');
            new TestDataDeleteBatch(standardPlan).execute(null, standardScope);
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
}