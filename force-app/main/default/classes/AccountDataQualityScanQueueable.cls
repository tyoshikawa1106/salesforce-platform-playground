/**
 * Cursorを分割取得して取引先データ品質を集計する非同期処理
 */
public with sharing class AccountDataQualityScanQueueable implements Queueable, Finalizer {

    // 1トランザクションで品質判定する既定件数
    private static final Integer DEFAULT_FETCH_SIZE = 500;

    private Database.Cursor accountCursor;
    private Integer position;
    private Id scanId;
    private Integer fetchSize;
    @TestVisible
    private Boolean shouldStopBeforeChainingForTest = false;
    private AccountDataQualityScanService service = new AccountDataQualityScanService();
    private AccountDataQualityScanSelector selector = new AccountDataQualityScanSelector();

    /**
     * 次の取得位置を保持したQueueableを作成
     *
     * @param accountCursor Queueable間で引き継ぐ取引先Cursor
     * @param position 今回の取得開始位置
     * @param scanId 更新対象のスキャン管理レコードID
     */
    public AccountDataQualityScanQueueable(Database.Cursor accountCursor, Integer position, Id scanId) {
        this.accountCursor = accountCursor;
        this.position = Math.max(position ?? 0, 0);
        this.scanId = scanId;
        this.fetchSize = DEFAULT_FETCH_SIZE;
    }

    /**
     * Queueable連鎖の境界確認用に取得件数を変更
     *
     * @param fetchSize テストで使用する取得件数
     */
    @TestVisible
    private void setFetchSizeForTest(Integer fetchSize) {
        this.fetchSize = fetchSize == null || fetchSize <= 0 ? DEFAULT_FETCH_SIZE : fetchSize;
    }

    /**
     * テストで最初の区間処理後にQueueable連鎖を停止
     */
    @TestVisible
    private void stopBeforeChainingForTest() {
        this.shouldStopBeforeChainingForTest = true;
    }

    /**
     * 1区間を集計し、残りがある場合は次のQueueableを登録
     *
     * @param context 現在のQueueable実行コンテキスト
     */
    public void execute(QueueableContext context) {
        System.attachFinalizer(this);
        DataQualityScan__c scanRecord = this.selector.getScanById(this.scanId);
        if (scanRecord == null || this.accountCursor == null) {
            throw new AccountDataQualityScanService.ScanException('スキャンを継続するための状態がありません。');
        }

        List<Account> accounts = this.selector.fetchAccounts(this.accountCursor, this.position, this.fetchSize);
        Integer nextPosition = Math.min(this.position + this.fetchSize, this.accountCursor.getNumRecords());
        DataQualityScan__c updatedScan = this.service.applyChunk(scanRecord, accounts, nextPosition);
        this.selector.updateScan(updatedScan);

        Boolean completed = this.service.isCompleted(updatedScan);
        if (!completed) {
            AccountDataQualityScanQueueable nextJob = new AccountDataQualityScanQueueable(
                this.accountCursor,
                nextPosition,
                this.scanId
            );
            nextJob.fetchSize = this.fetchSize;
            if (this.shouldStopBeforeChainingForTest) {
                return;
            }
            System.enqueueJob(nextJob);
        }
    }

    /**
     * Queueableの未処理例外をスキャン失敗状態へ記録
     *
     * @param context 親Queueableの実行結果
     */
    public void execute(FinalizerContext context) {
        if (context.getResult() == ParentJobResult.SUCCESS) {
            return;
        }
        DataQualityScan__c scanRecord = this.selector.getScanById(this.scanId);
        DataQualityScan__c failedScan = this.service.markFailed(scanRecord, AccountDataQualityScanService.SAFE_FAILURE_MESSAGE);
        if (failedScan != null) {
            this.selector.updateScan(failedScan);
        }
    }
}
