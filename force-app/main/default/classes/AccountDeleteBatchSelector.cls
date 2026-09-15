/**
 * 取引先削除の対象と標準バッチジョブを検索
 */
public with sharing class AccountDeleteBatchSelector {

    /**
     * 実行ユーザーが参照できる取引先全件の削除対象を取得
     * @return 個人取引先を含むQueryLocator
     */
    public Database.QueryLocator getAccounts() {
        // 種別で絞らず、共有と参照権限を適用してIDと通知用の名前を取得
        return Database.getQueryLocatorWithBinds(
            'SELECT Id, Name FROM Account',
            new Map<String, Object>(),
            AccessLevel.USER_MODE
        );
    }

    /**
     * 開始拒否時の空カーソルを取得
     * @return Accountを一切含まないQueryLocator
     */
    public Database.QueryLocator getNoAccounts() {
        // 権限不足でも空の結果で終了できるよう固定の不一致条件だけをシステムモードで実行
        return Database.getQueryLocatorWithBinds(
            'SELECT Id FROM Account WHERE Id = null',
            new Map<String, Object>(),
            AccessLevel.SYSTEM_MODE
        );
    }

    /**
     * 通知対象の標準ジョブを取得
     * @param jobId 実行コンテキストのジョブID
     * @return 対応するジョブ
     */
    public List<AsyncApexJob> getJobs(Id jobId) {
        return [
            SELECT Id, Status, NumberOfErrors
            FROM AsyncApexJob
            WHERE Id = :jobId AND ApexClass.Name = 'AccountDeleteBatch' AND JobType = 'BatchApex'
            WITH SYSTEM_MODE
            LIMIT 1
        ];
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