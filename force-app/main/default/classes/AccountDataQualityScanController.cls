/**
 * 取引先データ品質スキャンLWCのApex入口
 */
public with sharing class AccountDataQualityScanController {

    private static final String ACTIVE_SCAN_MESSAGE =
        '実行中のスキャンがあります。完了後にもう一度お試しください。';

    // 参照権限不足では結果や履歴なし表示に進めず権限確認を案内
    private static final String READ_ACCESS_MESSAGE =
        '取引先またはスキャン結果の参照権限がありません。管理者に権限を確認してください。';

    @TestVisible
    private static AccountDataQualityScanService service = new AccountDataQualityScanService();
    @TestVisible
    private static AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();

    /**
     * 直近のスキャン状態と集計結果を取得
     *
     * 読み取り専用であり、開始操作後はLWCから再取得が必要
     *
     * @return 直近スキャンの表示値、実行履歴がない場合はnull、参照権限不足時は案内のみ
     */
    @AuraEnabled(cacheable=true)
    public static AccountDataQualityScanWrapper getLatestScan() {
        // 結果の取得前に両オブジェクトの参照権限を確認
        if (!service.canReadScan()) {
            return new AccountDataQualityScanWrapper(READ_ACCESS_MESSAGE);
        }
        try {
            // 直近スキャンの未加工検索結果を取得
            List<DataQualityScan__c> latestScans = selector.getLatestScans();
            // 単一スキャンへの変換を Service へ委譲
            DataQualityScan__c latestScan = service.getFirstScan(latestScans);
            // 取得したスキャンを画面表示値へ変換
            return service.createViewModel(latestScan);
        } catch (Exception e) {
            throw createAuraHandledException('スキャン状態を取得できませんでした。時間をおいてもう一度お試しください。');
        }
    }

    /**
     * 取引先データ品質スキャンを開始
     *
     * @return 非同期実行を登録した待機中スキャンの表示値、参照権限不足時は案内のみ
     */
    @AuraEnabled
    public static AccountDataQualityScanWrapper startScan() {
        // 画面表示後に権限が変わった場合も保存や非同期登録の前に拒否
        if (!service.canReadScan()) {
            return new AccountDataQualityScanWrapper(READ_ACCESS_MESSAGE);
        }
        assertCanStartScan();
        DataQualityScan__c scanRecord;
        try {
            // 利用者が参照できる取引先を固定する Cursor を作成
            Database.Cursor accountCursor = selector.createAccountCursor();
            // Cursor 件数を初期値にした待機中スキャンを作成
            scanRecord = service.createPendingScan(accountCursor.getNumRecords(), UserInfo.getUserId());
            // 待機中スキャンを利用者権限で保存
            service.insertScan(scanRecord);
            // Cursor 分割処理を非同期キューへ登録
            new AccountDataQualityScanQueueable(accountCursor, 0, scanRecord.Id).enqueueInitialJob();
            // 非同期登録直後の待機状態を画面へ返却
            return service.createViewModel(scanRecord);
        } catch (AccountDataQualityScanService.ScanException e) {
            throw createAuraHandledException(e.getMessage());
        } catch (Exception e) {
            if (scanRecord != null && scanRecord.Id != null) {
                DataQualityScan__c failedScan = service.markFailed(scanRecord, AccountDataQualityScanService.SAFE_FAILURE_MESSAGE);
                // 開始途中の失敗状態を利用者権限で保存
                service.updateScan(failedScan);
            }
            throw createAuraHandledException('スキャンを開始できませんでした。権限を確認してもう一度お試しください。');
        }
    }

    private static void assertCanStartScan() {
        DataQualityScan__c activeScan;
        try {
            // 実行中スキャンの未加工検索結果を取得
            List<DataQualityScan__c> activeScans = selector.getActiveScans();
            // 単一スキャンへの変換を Service へ委譲
            activeScan = service.getFirstScan(activeScans);
        } catch (Exception e) {
            throw createAuraHandledException('スキャンを開始できませんでした。権限を確認してもう一度お試しください。');
        }
        // 保存済みの実行中スキャンがある場合は利用者向けエラーへ変換
        if (!service.canStartScan(activeScan)) {
            throw createAuraHandledException(ACTIVE_SCAN_MESSAGE);
        }
    }

    private static AuraHandledException createAuraHandledException(String message) {
        AuraHandledException exceptionRecord = new AuraHandledException(message);
        exceptionRecord.setMessage(message);
        return exceptionRecord;
    }
}