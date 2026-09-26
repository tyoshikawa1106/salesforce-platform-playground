/** 法人取引先の検索条件・更新判定・画面応答 */
public with sharing class AccountMassUpdateWrapper {

    // 利用者へ返す拒否理由
    @AuraEnabled
    public String errorMessage { get; set; }
    // 現在のページまたは更新成功後のレコード
    @AuraEnabled
    public List<Account> records { get; set; }
    // 行ごとの保存失敗理由
    @AuraEnabled
    public Map<Id, String> errors { get; set; }
    // 保存に成功した行
    @AuraEnabled
    public List<Id> successIds { get; set; }
    // 後続ページの有無
    @AuraEnabled
    public Boolean hasNext;
    // 更新可能な項目名
    @AuraEnabled
    public List<String> editableFields { get; set; }
    // 作成日の開始日
    @AuraEnabled
    public Date startDate { get; set; }
    // 作成日の終了日
    @AuraEnabled
    public Date endDate { get; set; }
    public Set<Id> recordIds { get; set; }
    // 取引先名の部分一致条件
    @AuraEnabled
    public String searchTerm { get; set; }
    public Datetime startAt { get; set; }
    public Datetime endBefore { get; set; }
    // 前ページ末尾の作成日時
    @AuraEnabled
    public Datetime afterCreated { get; set; }
    // 前ページ末尾の取引先ID
    @AuraEnabled
    public Id afterId { get; set; }
    public Boolean personAccountsEnabled;
    public Boolean recordTypesEnabled;

    /** 空の検索・保存結果を初期化 */
    public AccountMassUpdateWrapper() {
        // 未実行の応答をエラーなしで開始
        this.errorMessage = '';
        // 検索・更新対象の空の一覧を用意
        this.records = new List<Account>();
        // 行別の拒否理由を格納する領域を用意
        this.errors = new Map<Id, String>();
        // 保存済みの行がない状態で開始
        this.successIds = new List<Id>();
        // 未検索時は後続ページなしとして扱う
        this.hasNext = false;
        // 権限確認前は編集項目を許可しない
        this.editableFields = new List<String>();
        // 検証済みの取得対象IDを格納する領域を用意
        this.recordIds = new Set<Id>();
        // 未入力の名前条件を空文字として保持
        this.searchTerm = '';
        // 組織機能の判定前は個人取引先条件を無効にする
        this.personAccountsEnabled = false;
        // 組織にレコードタイプ項目がある場合だけ取得
        this.recordTypesEnabled = false;
    }
}