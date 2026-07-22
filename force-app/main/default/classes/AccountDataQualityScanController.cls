/**
 * 取引先データ品質スキャンLWCのApex入口
 */
public with sharing class AccountDataQualityScanController {

    @TestVisible
    private static AccountDataQualityScanService service = new AccountDataQualityScanService();
    @TestVisible
    private static AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();

    /**
     * 直近のスキャン状態と集計結果を取得
     *
     * 読み取り専用であり、開始操作後はLWCから再取得が必要
     *
     * @return 直近スキャンの表示値、実行履歴がない場合はnull
     */
    @AuraEnabled(cacheable=true)
    public static AccountDataQualityScanWrapper getLatestScan() {
        try {
            DataQualityScan__c latestScan = selector.getLatestScan();
            return service.createViewModel(latestScan);
        } catch (Exception e) {
            throw createAuraHandledException('スキャン状態を取得できませんでした。時間をおいてもう一度お試しください。');
        }
    }

    /**
     * 取引先データ品質スキャンを開始
     *
     * @return 非同期実行を登録した待機中スキャンの表示値
     */
    @AuraEnabled
    public static AccountDataQualityScanWrapper startScan() {
        DataQualityScan__c scanRecord;
        try {
            DataQualityScan__c activeScan = selector.getActiveScan();
            service.validateStart(activeScan);
            Database.Cursor accountCursor = selector.createAccountCursor();
            scanRecord = service.createPendingScan(accountCursor.getNumRecords(), UserInfo.getUserId());
            selector.insertScan(scanRecord);
            System.enqueueJob(new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id));
            return service.createViewModel(scanRecord);
        } catch (AccountDataQualityScanService.ScanException e) {
            throw createAuraHandledException(e.getMessage());
        } catch (Exception e) {
            if (scanRecord != null && scanRecord.Id != null) {
                DataQualityScan__c failedScan = service.markFailed(scanRecord, AccountDataQualityScanService.SAFE_FAILURE_MESSAGE);
                selector.updateScan(failedScan);
            }
            throw createAuraHandledException('スキャンを開始できませんでした。権限を確認してもう一度お試しください。');
        }
    }

    private static AuraHandledException createAuraHandledException(String message) {
        AuraHandledException exceptionRecord = new AuraHandledException(message);
        exceptionRecord.setMessage(message);
        return exceptionRecord;
    }
}
