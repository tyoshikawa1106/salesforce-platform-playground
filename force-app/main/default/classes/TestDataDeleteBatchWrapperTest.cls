/** 削除計画の依存順序と状態分離を検証 */
@IsTest
private with sharing class TestDataDeleteBatchWrapperTest {
    @IsTest
    static void ordersChildrenBeforeParents() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            List<String> names = plan.objectNames;
            Assert.isTrue(names.indexOf('WorkOrderLineItem') < names.indexOf('WorkOrder'), '作業指示明細を先に削除');
            Assert.isTrue(names.indexOf('WorkOrder') < names.indexOf('Case'), 'ケースを参照する作業指示を先に削除');
            Assert.isTrue(names.indexOf('Case') < names.indexOf('Entitlement'), '権利を参照するケースを先に削除');
            Assert.isTrue(
                names.indexOf('Entitlement') < names.indexOf('ContractLineItem'),
                '契約明細を参照する権利を先に削除'
            );
            Assert.isTrue(names.indexOf('OrderItem') < names.indexOf('Order'), '注文明細を先に削除');
            Assert.isTrue(names.indexOf('Order') < names.indexOf('Contract'), '注文の後に契約を削除');
            Assert.isTrue(
                names.indexOf('OpportunityLineItem') < names.indexOf('PricebookEntry'),
                '商談商品を価格表エントリより先に削除'
            );
            Assert.areEqual('Account', names[names.size() - 1], '取引先は最後');
            Assert.isFalse(names.contains('User'), 'ユーザーを削除しない');
            Assert.isFalse(names.contains('PermissionSet'), '権限セットを削除しない');
            Assert.isFalse(names.contains('Pricebook2'), '標準価格表を削除しない');
        }
    }
    @IsTest
    static void copiesStateWithoutAliasing() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteBatchWrapper first = new TestDataDeleteBatchWrapper();
            first.errorCodes.add('ERROR');
            TestDataDeleteBatchWrapper second = new TestDataDeleteBatchWrapper(first);
            second.errorCodes.clear();
            second.objectNames.clear();
            Assert.areEqual(1, first.errorCodes.size(), 'エラー一覧を複製');
            Assert.isFalse(first.objectNames.isEmpty(), '削除計画を複製');
        }
    }
}