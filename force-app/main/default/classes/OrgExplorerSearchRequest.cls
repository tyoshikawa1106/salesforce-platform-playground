/**
 * 起点ロールの候補検索要求
 */
public with sharing class OrgExplorerSearchRequest {

    // 要求との対応キー
    @AuraEnabled
    public String requestId { get; set; }
    // 前後空白を除いて検索するロール名
    @AuraEnabled
    public String term { get; set; }
    // 初期値を解決するロールAPI名、通常検索では空文字
    @AuraEnabled
    public String developerName { get; set; }

    // 上司候補の有効条件、ALLまたはACTIVE
    @AuraEnabled
    public String activityFilter { get; set; }

    /**
     * ロール検索の条件を未指定で初期化
     */
    public OrgExplorerSearchRequest() {
        // 要求との対応キーを初期化
        this.requestId = '';
        // 前後空白を除いて検索するロール名を初期化
        this.term = '';
        // ロール検索には影響しない上司候補の初期条件
        this.activityFilter = 'ALL';
        // 通常の候補検索ではAPI名を指定しない
        this.developerName = '';
    }
}