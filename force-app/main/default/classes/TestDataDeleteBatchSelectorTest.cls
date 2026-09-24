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
}
