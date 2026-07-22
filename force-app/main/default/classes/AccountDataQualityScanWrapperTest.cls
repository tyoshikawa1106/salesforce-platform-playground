/**
 * 取引先データ品質スキャン画面表示値テスト
 */
@IsTest
private with sharing class AccountDataQualityScanWrapperTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * nullの集計値をゼロとして画面表示値へ変換
     */
    @IsTest
    static void shouldNormalizeNullCountsWhenCreatingWrapper() {
        DataQualityScan__c scanRecord = new DataQualityScan__c();
        scanRecord.Status__c = AccountDataQualityScanService.STATUS_PENDING;
        AccountDataQualityScanWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountDataQualityScanWrapper(scanRecord, 0);

            Test.stopTest();
        }

        Assert.areEqual(0, result.totalCount, 'nullの対象総件数はゼロへ変換する必要あり');
        Assert.areEqual(0, result.processedCount, 'nullの処理済み件数はゼロへ変換する必要あり');
        Assert.areEqual(0, result.missingPhoneCount, 'nullの不足件数はゼロへ変換する必要あり');
        Assert.areEqual(AccountDataQualityScanService.STATUS_PENDING, result.status, '状態値をそのまま返す必要あり');
    }
}
