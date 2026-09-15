/** バッチが引き継ぐ取引先削除の集計結果 */
public with sharing class AccountDeleteBatchWrapper {

    public Integer successCount { get; set; }
    public Integer failureCount { get; set; }
    public Map<Id, String> recordErrors { get; set; }
    public Set<String> failureReasons { get; set; }
    public String errorMessage { get; set; }

    /** 集計前の状態を初期化 */
    public AccountDeleteBatchWrapper() {
        // 成功・失敗件数を累積できる初期値にする
        this.successCount = 0;
        this.failureCount = 0;
        // レコード別のエラーと処理全体の中止理由を初期化
        this.recordErrors = new Map<Id, String>();
        this.failureReasons = new Set<String>();
        // エラーがない状態を空文字で表す
        this.errorMessage = '';
    }

    /**
     * 元の集計値を変更せず更新するためのコピーを作成
     * @param source コピー元の集計結果
     */
    public AccountDeleteBatchWrapper(AccountDeleteBatchWrapper source) {
        // 確定した件数を引き継ぐ
        this.successCount = source.successCount;
        this.failureCount = source.failureCount;
        // コピー先の変更が元の集計結果へ影響しないようにする
        this.recordErrors = source.recordErrors == null ? new Map<Id, String>() : source.recordErrors.clone();
        this.failureReasons = source.failureReasons == null ? new Set<String>() : source.failureReasons.clone();
        // 呼び出し元の判定結果を引き継ぐ
        this.errorMessage = source.errorMessage;
    }
}