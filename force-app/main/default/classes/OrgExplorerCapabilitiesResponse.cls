/**
 * 利用可能な階層モードと制御値
 */
public with sharing class OrgExplorerCapabilitiesResponse {

    // 上司階層を利用できるかどうか
    // 公開DTOの自動setterであり、処理を切り替えるBoolean引数には該当しない
    @SuppressWarnings('PMD.AvoidBooleanMethodParameters')
    @AuraEnabled
    public Boolean managerModeEnabled { get; set; }
    // ロール階層を利用できるかどうか
    // 公開DTOの自動setterであり、処理を切り替えるBoolean引数には該当しない
    @SuppressWarnings('PMD.AvoidBooleanMethodParameters')
    @AuraEnabled
    public Boolean roleModeEnabled { get; set; }
    // ロール所属を参照できるかどうか
    // 公開DTOの自動setterであり、処理を切り替えるBoolean引数には該当しない
    @SuppressWarnings('PMD.AvoidBooleanMethodParameters')
    @AuraEnabled
    public Boolean roleMembersEnabled { get; set; }

    // 上司カードで参照可能なSalesforce項目のラベル
    @AuraEnabled
    public Map<String, String> cardFieldLabels { get; set; }

    /**
     * 取得前の機能情報と画面制御値を初期化
     */
    public OrgExplorerCapabilitiesResponse() {
        // 別要求の項目ラベルを引き継がない
        this.cardFieldLabels = new Map<String, String>();
        // 上司階層を利用できるかどうかを初期化
        this.managerModeEnabled = false;
        // ロール階層を利用できるかどうかを初期化
        this.roleModeEnabled = false;
        // ロール所属を参照できるかどうかを初期化
        this.roleMembersEnabled = false;
    }
}
