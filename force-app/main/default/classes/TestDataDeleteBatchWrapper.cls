/** テストデータ削除の固定対象とバッチ間で受け渡す集計値 */
public with sharing class TestDataDeleteBatchWrapper {
    /** 削除を許可する開発環境と対象外環境の区分 */
    public enum Environment {
        DEVELOPMENT,
        DISALLOWED
    }

    public List<String> objectNames;
    public Integer position;
    // カスタム価格の削除後だけ標準価格の段階へ進む
    public Boolean standardPricePhase;
    public Integer totalSuccessCount;
    public Integer totalFailureCount;
    public Integer successCount;
    public Integer failureCount;
    public List<String> errorCodes;
    public String errorMessage;

    /** 子から親への削除計画と未実行の集計値を初期化 */
    public TestDataDeleteBatchWrapper() {
        // ファイルは全バージョンを含むContentDocument単位で削除
        this.objectNames = new List<String>{
            'ContentDocument',
            'EmailMessage',
            'Task',
            'Event',
            'WorkOrderLineItem',
            'WorkOrder',
            'Case',
            'Entitlement',
            'ContractLineItem',
            'ServiceContract',
            'OrderItem',
            'Order',
            'OpportunityContactRole',
            'OpportunityLineItem',
            'Opportunity',
            'Contract',
            'Asset',
            'CampaignMember',
            'Campaign',
            'Lead',
            'Contact',
            'PricebookEntry',
            'Product2',
            'Account'
        };
        // 状態は独自レコードに保存せずバッチインスタンスで保持
        this.position = 0;
        this.standardPricePhase = false;
        this.totalSuccessCount = 0;
        this.totalFailureCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
        this.errorCodes = new List<String>();
        this.errorMessage = '';
    }

    /**
     * 元の集計値を変更せず次の処理へ渡す値を複製
     * @param current 複製元
     */
    public TestDataDeleteBatchWrapper(TestDataDeleteBatchWrapper current) {
        // コレクションも複製しServiceから呼び出し元への副作用を防止
        this.objectNames = current.objectNames.clone();
        this.position = current.position;
        this.standardPricePhase = current.standardPricePhase;
        this.totalSuccessCount = current.totalSuccessCount;
        this.totalFailureCount = current.totalFailureCount;
        this.successCount = current.successCount;
        this.failureCount = current.failureCount;
        this.errorCodes = current.errorCodes.clone();
        this.errorMessage = current.errorMessage;
    }
}
