/**
 * 取引先データ品質の判定とスキャン状態遷移
 */
public with sharing class AccountDataQualityScanService {

    // 新規スキャンが非同期実行を待つ状態
    public static final String STATUS_PENDING = 'Pending';
    // Cursorの分割処理が継続中の状態
    public static final String STATUS_RUNNING = 'Running';
    // Cursorの全取得位置を処理した状態
    public static final String STATUS_COMPLETED = 'Completed';
    // 非同期処理を継続できない状態
    public static final String STATUS_FAILED = 'Failed';
    // MVPで重複実行を防ぐ対象キー
    public static final String ACCOUNT_ACTIVE_KEY = 'Account';
    // 管理レコードへ固定する対象オブジェクト
    private static final String ACCOUNT_OBJECT = 'Account';
    // 内部情報を公開せず再実行を案内する失敗文言
    public static final String SAFE_FAILURE_MESSAGE = 'スキャン処理に失敗しました。時間をおいて再実行してください。';

    /**
     * Cursor件数を初期値にした待機中スキャンを作成
     *
     * @param totalCount Cursor作成時の対象総件数
     * @param requestedById スキャンを開始した利用者ID
     * @return 未保存のスキャン管理レコード
     */
    public DataQualityScan__c createPendingScan(Integer totalCount, Id requestedById) {
        DataQualityScan__c scanRecord = new DataQualityScan__c();
        scanRecord.Status__c = STATUS_PENDING;
        scanRecord.Target_Object__c = ACCOUNT_OBJECT;
        scanRecord.Total_Count__c = totalCount ?? 0;
        scanRecord.Processed_Count__c = 0;
        scanRecord.Missing_Phone_Count__c = 0;
        scanRecord.Missing_Industry_Count__c = 0;
        scanRecord.Missing_Address_Count__c = 0;
        scanRecord.Missing_Website_Count__c = 0;
        scanRecord.Missing_Account_Number_Count__c = 0;
        scanRecord.Started_At__c = System.now();
        scanRecord.Requested_By__c = requestedById;
        scanRecord.Active_Key__c = ACCOUNT_ACTIVE_KEY;
        return scanRecord;
    }

    /**
     * 単一取得用の検索結果からスキャン管理レコードを確定
     *
     * @param scans Selector が返したスキャン一覧
     * @return 先頭のスキャン、存在しない場合は空のスキャン管理レコード
     */
    public DataQualityScan__c getFirstScan(List<DataQualityScan__c> scans) {
        // null の検索結果を空の List として扱えるよう正規化
        List<DataQualityScan__c> safeScans = scans ?? new List<DataQualityScan__c>();
        // 取得結果がない場合も非 null のスキャン管理レコードを返却
        if (safeScans.isEmpty()) {
            return new DataQualityScan__c();
        }
        // 単一レコード用 SOQL の先頭結果を呼び出し元へ返却
        return safeScans[0];
    }

    /**
     * 新しいスキャン管理レコードを利用者権限で保存
     *
     * @param scanRecord 保存するスキャン管理レコード
     * @return ID が設定されたスキャン管理レコード
     * @throws ScanException 保存対象がない場合
     */
    public DataQualityScan__c insertScan(DataQualityScan__c scanRecord) {
        // 保存対象がない DML を明示的に拒否
        if (scanRecord == null) {
            throw new ScanException('保存するスキャン管理レコードがありません。');
        }
        // 画面利用者の権限で新しいスキャン管理レコードを保存
        insert as user scanRecord;
        // 採番された ID を持つスキャン管理レコードを返却
        return scanRecord;
    }

    /**
     * スキャン進捗と集計結果を利用者権限で保存
     *
     * @param scanRecord 更新するスキャン管理レコード
     * @throws ScanException 更新対象がない場合
     */
    public void updateScan(DataQualityScan__c scanRecord) {
        // 更新対象がない DML を明示的に拒否
        if (scanRecord?.Id == null) {
            throw new ScanException('更新するスキャン管理レコードがありません。');
        }
        // 画面利用者の権限で進捗と集計結果を保存
        update as user scanRecord;
    }

    /**
     * 新しいスキャンを開始できるかを判定
     *
     * @param activeScan 現在の実行中スキャン、存在しない場合は空のスキャン管理レコード
     * @return 保存済みの実行中スキャンがない場合は true
     */
    public Boolean canStartScan(DataQualityScan__c activeScan) {
        // 保存済みの実行中スキャンがない場合だけ新規開始を許可
        return activeScan?.Id == null;
    }

    /**
     * 1回のCursor取得結果を累積値と次状態へ反映
     *
     * @param scanRecord 更新対象のスキャン管理レコード
     * @param accounts 今回取得した取引先
     * @param nextPosition 次のQueueableが開始するCursor位置
     * @return 更新値を反映したスキャン管理レコード
     * @throws ScanException nullまたは終了済みのスキャンを渡した場合
     */
    public DataQualityScan__c applyChunk(DataQualityScan__c scanRecord, List<Account> accounts, Integer nextPosition) {
        validateProcessableScan(scanRecord);
        List<Account> safeAccounts = accounts ?? new List<Account>();
        ChunkCounts chunkCounts = countMissingValues(safeAccounts);
        Integer safeNextPosition = Math.max(nextPosition ?? 0, 0);
        Integer totalCount = toInteger(scanRecord.Total_Count__c);

        scanRecord.Status__c = STATUS_RUNNING;
        scanRecord.Processed_Count__c = Math.min(safeNextPosition, totalCount);
        scanRecord.Missing_Phone_Count__c = toInteger(scanRecord.Missing_Phone_Count__c) + chunkCounts.missingPhoneCount;
        scanRecord.Missing_Industry_Count__c = toInteger(scanRecord.Missing_Industry_Count__c) + chunkCounts.missingIndustryCount;
        scanRecord.Missing_Address_Count__c = toInteger(scanRecord.Missing_Address_Count__c) + chunkCounts.missingAddressCount;
        scanRecord.Missing_Website_Count__c = toInteger(scanRecord.Missing_Website_Count__c) + chunkCounts.missingWebsiteCount;
        scanRecord.Missing_Account_Number_Count__c = toInteger(scanRecord.Missing_Account_Number_Count__c) + chunkCounts.missingAccountNumberCount;

        if (safeNextPosition >= totalCount) {
            completeScan(scanRecord);
        }
        return scanRecord;
    }

    /**
     * スキャンを安全なエラー文言付きの失敗状態へ変更
     *
     * @param scanRecord 更新対象のスキャン管理レコード
     * @param errorMessage 利用者へ表示できるエラー文言
     * @return 失敗状態を反映したスキャン管理レコード
     */
    public DataQualityScan__c markFailed(DataQualityScan__c scanRecord, String errorMessage) {
        // 更新対象がない場合も非 null のスキャン管理レコードを返却
        if (scanRecord == null) {
            return new DataQualityScan__c();
        }
        // 再実行可能な失敗状態へ遷移
        scanRecord.Status__c = STATUS_FAILED;
        // 失敗を確定した時刻を記録
        scanRecord.Completed_At__c = System.now();
        // 内部情報を含まない利用者向け文言へ統一
        scanRecord.Error_Message__c = String.isBlank(errorMessage) ? SAFE_FAILURE_MESSAGE : errorMessage;
        // 後続の再実行を許可するため重複防止キーを解放
        scanRecord.Active_Key__c = null;
        // 失敗状態を反映したスキャン管理レコードを返却
        return scanRecord;
    }

    /**
     * 管理レコードをLWC表示値へ変換
     *
     * @param scanRecord 表示対象のスキャン管理レコード
     * @return 進捗率を含む表示値、対象がない場合はnull
     */
    public AccountDataQualityScanWrapper createViewModel(DataQualityScan__c scanRecord) {
        // 保存済みスキャンがない場合は画面へ履歴なしを返却
        if (scanRecord?.Id == null) {
            return null;
        }
        Decimal progressPercent = calculateProgress(scanRecord);
        return new AccountDataQualityScanWrapper(scanRecord, progressPercent);
    }

    /**
     * スキャンが完了状態か判定
     *
     * @param scanRecord 判定対象のスキャン管理レコード
     * @return 完了状態の場合はtrue
     */
    public Boolean isCompleted(DataQualityScan__c scanRecord) {
        return scanRecord != null && scanRecord.Status__c == STATUS_COMPLETED;
    }

    private static ChunkCounts countMissingValues(List<Account> accounts) {
        ChunkCounts result = new ChunkCounts();
        for (Account accountRecord : accounts) {
            if (String.isBlank(accountRecord.Phone)) {
                result.missingPhoneCount++;
            }
            if (String.isBlank(accountRecord.Industry)) {
                result.missingIndustryCount++;
            }
            if (isBillingAddressIncomplete(accountRecord)) {
                result.missingAddressCount++;
            }
            if (String.isBlank(accountRecord.Website)) {
                result.missingWebsiteCount++;
            }
            if (String.isBlank(accountRecord.AccountNumber)) {
                result.missingAccountNumberCount++;
            }
        }
        return result;
    }

    private static Boolean isBillingAddressIncomplete(Account accountRecord) {
        return String.isBlank(accountRecord.BillingStreet) ||
            String.isBlank(accountRecord.BillingCity) ||
            String.isBlank(accountRecord.BillingState) ||
            String.isBlank(accountRecord.BillingPostalCode) ||
            String.isBlank(accountRecord.BillingCountry);
    }

    private static void validateProcessableScan(DataQualityScan__c scanRecord) {
        if (scanRecord == null) {
            throw new ScanException('スキャン管理レコードがありません。');
        }
        Boolean isProcessable = scanRecord.Status__c == STATUS_PENDING || scanRecord.Status__c == STATUS_RUNNING;
        if (!isProcessable) {
            throw new ScanException('終了済みのスキャンは更新できません。');
        }
    }

    private static void completeScan(DataQualityScan__c scanRecord) {
        scanRecord.Status__c = STATUS_COMPLETED;
        scanRecord.Completed_At__c = System.now();
        scanRecord.Error_Message__c = null;
        scanRecord.Active_Key__c = null;
    }

    private static Decimal calculateProgress(DataQualityScan__c scanRecord) {
        Decimal totalCount = scanRecord.Total_Count__c ?? 0;
        Decimal processedCount = scanRecord.Processed_Count__c ?? 0;
        if (totalCount <= 0) {
            return scanRecord.Status__c == STATUS_COMPLETED ? 100 : 0;
        }
        Decimal progressPercent = (processedCount * 100) / totalCount;
        return Math.min(progressPercent, 100).setScale(0);
    }

    private static Integer toInteger(Decimal value) {
        return value == null ? 0 : value.intValue();
    }

    private class ChunkCounts {
        public Integer missingPhoneCount = 0;
        public Integer missingIndustryCount = 0;
        public Integer missingAddressCount = 0;
        public Integer missingWebsiteCount = 0;
        public Integer missingAccountNumberCount = 0;
    }

    /**
     * スキャン状態または入力が処理条件を満たさない場合の例外
     */
    public class ScanException extends Exception {
    }
}
