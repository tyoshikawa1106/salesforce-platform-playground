/** 削除画面の実効権限、残件数、標準ジョブを検索 */
public virtual with sharing class TestDataDeleteSelector {
    /** 現在組織の削除許可判定に必要な情報を取得
     * @return 組織種別とScratchの有効期限
     */
    public List<Organization> getOrganizations() {
        // 利用者の設定参照権限に依存せず組織種別を取得
        return [SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization WITH SYSTEM_MODE LIMIT 1];
    }

    /** 現在のユーザーの実効権限を取得
     * @return 合成済み実効権限
     */
    public virtual List<UserPermissionAccess> getPermissions() {
        // 合成済み権限を使い期限切れやミュートされた割当を数えない
        return [
            SELECT PermissionsModifyAllData
            FROM UserPermissionAccess
            WITH SYSTEM_MODE
            LIMIT 1
        ];
    }

    /** 同機能の重複起動を確認
     * @return 実行中ジョブ、最大一件
     */
    public List<AsyncApexJob> getActiveJobs() {
        // 他ユーザーのジョブの詳細は応答へ含めない
        return [
            SELECT Id
            FROM AsyncApexJob
            WHERE
                ApexClass.Name = 'TestDataDeleteBatch'
                AND JobType = 'BatchApex'
                AND Status IN ('Holding', 'Queued', 'Preparing', 'Processing')
            WITH SYSTEM_MODE
            LIMIT 1
        ];
    }

    /**
     * 受付したIDだけを追跡し後から作成された別実行へ置き換えない
     * @param jobId 追跡ID、未指定の場合は検索しない
     * @return 実行者自身の対象ジョブ
     */
    public List<AsyncApexJob> getJobs(Id jobId) {
        // 未指定を最新ジョブ検索へ置き換えない
        if (jobId == null) {
            return new List<AsyncApexJob>();
        }
        return [
            SELECT Id, Status, JobItemsProcessed, TotalJobItems, NumberOfErrors
            FROM AsyncApexJob
            WHERE
                Id = :jobId
                AND CreatedById = :UserInfo.getUserId()
                AND ApexClass.Name = 'TestDataDeleteBatch'
                AND JobType = 'BatchApex'
            WITH SYSTEM_MODE
        ];
    }

    /**
     * 一回の呼び出しで一オブジェクトの件数を取得
     * @param objectName Serviceが検証済みのAPI名
     * @return ごみ箱を除いた全件数
     */
    public Integer getRemaining(String objectName) {
        // 履歴を保存せず画面の再確認時点の残存を返却
        String query = 'SELECT COUNT() FROM ' + objectName + ' WHERE IsDeleted = false ALL ROWS';
        return Database.countQueryWithBinds(query, new Map<String, Object>(), AccessLevel.USER_MODE);
    }
}