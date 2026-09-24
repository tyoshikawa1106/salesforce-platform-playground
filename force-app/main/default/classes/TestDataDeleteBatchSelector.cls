/** バッチの実効権限、削除対象、標準ジョブを取得 */
public with sharing class TestDataDeleteBatchSelector {
    /** 現在組織の削除許可判定に必要な情報を取得
     * @return 組織種別とScratchの有効期限
     */
    public List<Organization> getOrganizations() {
        // 利用者の設定参照権限に依存せず組織種別を取得
        return [SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization WITH SYSTEM_MODE LIMIT 1];
    }

    /** 実行ユーザーの実効権限を取得
     * @return 合成済み実効権限
     */
    public List<UserPermissionAccess> getPermissions() {
        // プロファイル・権限セット・グループの合成結果を使用
        return [
            SELECT PermissionsModifyAllData, PermissionsQueryAllFiles
            FROM UserPermissionAccess
            WITH SYSTEM_MODE
            LIMIT 1
        ];
    }

    /**
     * 検証済みのオブジェクトを全件取得
     * @param objectName Serviceで検証済みのAPI名
     * @param recordFilter Serviceで検証済みのレコード抽出条件
     * @return 削除対象のカーソル
     */
    public Database.QueryLocator getRecords(String objectName, String recordFilter) {
        // Contactの個人取引先分はAccount削除に連動させ、アーカイブ済み活動も含める
        String query = 'SELECT Id FROM ' + objectName + ' WHERE ' + recordFilter + ' ALL ROWS';
        return Database.getQueryLocatorWithBinds(query, new Map<String, Object>(), AccessLevel.USER_MODE);
    }

    /**
     * 現在のジョブを取得
     * @param jobId バッチコンテキストのID
     * @return 対象ジョブ
     */
    public List<AsyncApexJob> getJob(Id jobId) {
        // 標準ジョブの未処理例外をfinishで確認
        return [
            SELECT Id, NumberOfErrors
            FROM AsyncApexJob
            WHERE Id = :jobId AND ApexClass.Name = 'TestDataDeleteBatch'
            WITH SYSTEM_MODE
        ];
    }

    /**
     * 同じ機能の別ジョブとの競合を取得
     * @param jobId 現在のジョブID
     * @return 他の実行中ジョブ
     */
    public List<AsyncApexJob> getOtherActiveJobs(Id jobId) {
        // startでの再判定により受付直後の同時起動も削除前に拒否
        return [
            SELECT Id
            FROM AsyncApexJob
            WHERE
                ApexClass.Name = 'TestDataDeleteBatch'
                AND JobType = 'BatchApex'
                AND Id != :jobId
                AND Status IN ('Holding', 'Queued', 'Preparing', 'Processing')
            WITH SYSTEM_MODE
            LIMIT 1
        ];
    }

    /**
     * 検証済みのオブジェクトの残存を集計
     * @param objectName Serviceで検証済みのAPI名
     * @param recordFilter Serviceで検証済みのレコード抽出条件
     * @return 未削除件数
     */
    public Integer getRemaining(String objectName, String recordFilter) {
        // 個人取引先のContactは親削除前の停止条件から除く
        String query = 'SELECT COUNT() FROM ' + objectName + ' WHERE ' + recordFilter + ' ALL ROWS';
        return Database.countQueryWithBinds(query, new Map<String, Object>(), AccessLevel.USER_MODE);
    }
}
