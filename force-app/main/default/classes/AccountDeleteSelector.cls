/** 画面に表示する実行者自身の標準ジョブを検索 */
public with sharing class AccountDeleteSelector {

    /**
     * 自身の追跡対象を取得し、初回表示のみ最新ジョブを取得
     * @param jobId 追跡対象のジョブID、未指定時は最新ジョブ
     * @return 条件に一致する自身のジョブ、最大一件
     */
    public List<AsyncApexJob> getJobs(Id jobId) {
        // 指定IDの有無にかかわらず実行者とバッチ種別を限定
        Map<String, Object> binds = new Map<String, Object>{ 'requestedBy' => UserInfo.getUserId() };
        String query = 'SELECT Id, Status, NumberOfErrors FROM AsyncApexJob' +
            ' WHERE CreatedById = :requestedBy AND ApexClass.Name = \'AccountDeleteBatch\' AND JobType = \'BatchApex\'';
        // 追跡中は新しいジョブが作成されても検索対象を変えない
        if (jobId != null) {
            query += ' AND Id = :jobId';
            binds.put('jobId', jobId);
        }
        // ID未指定の初回表示では最新一件を選ぶ
        query += ' ORDER BY CreatedDate DESC, Id DESC LIMIT 1';
        return Database.queryWithBinds(query, binds, AccessLevel.SYSTEM_MODE);
    }

    /**
     * 受付済みの重複ジョブを確認
     * @return 実行中の同機能ジョブ、最大一件
     */
    public List<AsyncApexJob> getActiveJobs() {
        // 他ユーザーのジョブ情報は画面へ公開せず重複判定のみに使用
        return [
            SELECT Id
            FROM AsyncApexJob
            WHERE
                ApexClass.Name = 'AccountDeleteBatch'
                AND JobType = 'BatchApex'
                AND Status IN ('Holding', 'Queued', 'Preparing', 'Processing')
            WITH SYSTEM_MODE
            LIMIT 1
        ];
    }
}