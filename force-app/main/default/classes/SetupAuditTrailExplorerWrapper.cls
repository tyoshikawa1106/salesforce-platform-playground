/** 設定変更履歴のページと集計結果を画面に返す。 */
public class SetupAuditTrailExplorerWrapper {
    @AuraEnabled public List<SetupAuditTrail> records { get; set; }
    @AuraEnabled public List<Bucket> buckets { get; set; }
    @AuraEnabled public Map<String, List<String>> options { get; set; }
    @AuraEnabled public Map<String, String> userOptions { get; set; }
    @AuraEnabled public Map<String, String> userNames { get; set; }
    @AuraEnabled public Id nextId { get; set; }
    @AuraEnabled public Datetime nextTime { get; set; }
    // 全期間CSVの各ページに共通する取得上限（この日時を含まない）。
    @AuraEnabled public Datetime cutoff { get; set; }
    // CSVの先頭ページで返す、履歴に裏付けられたSalesforce側の作成者ID。
    @AuraEnabled public List<Id> employeeActorIds { get; set; }

    /**
     * 履歴・集計の応答を初期化する。
     */
    public SetupAuditTrailExplorerWrapper() {
        records = new List<SetupAuditTrail>();
        buckets = new List<Bucket>();
    }

    /** 同じ日・ユーザー・アクション・名前空間・代理ユーザーの変更件数。 */
    public class Bucket {
        @AuraEnabled public String day { get; set; }
        @AuraEnabled public Id userId { get; set; }
        @AuraEnabled public String userName { get; set; }
        @AuraEnabled public String loginName { get; set; }
        @AuraEnabled public String action { get; set; }
        @AuraEnabled public String section { get; set; }
        @AuraEnabled public String namespacePrefix { get; set; }
        @AuraEnabled public String delegateUser { get; set; }
        @AuraEnabled public Integer count { get; set; }
    }
}
