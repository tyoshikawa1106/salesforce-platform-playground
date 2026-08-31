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
        AccountDataQualityScanWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountDataQualityScanWrapper(scanRecord, null);

            Test.stopTest();
        }

        Assert.areEqual(0, result.totalCount, 'nullの対象総件数はゼロへ変換する必要あり');
        Assert.areEqual(0, result.processedCount, 'nullの処理済み件数はゼロへ変換する必要あり');
        Assert.areEqual(0, result.missingPhoneCount, 'nullの不足件数はゼロへ変換する必要あり');
        Assert.areEqual('', result.status, 'nullの状態値は空文字列へ変換する必要あり');
        Assert.areEqual(0, result.progressPercent, 'nullの進捗率はゼロへ変換する必要あり');
        Assert.areEqual('', result.errorMessage, 'nullのエラー文言は空文字列へ変換する必要あり');
    }
}