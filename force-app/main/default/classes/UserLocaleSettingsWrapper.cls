/** ログインユーザーの言語・地域設定と処理結果 */
public with sharing class UserLocaleSettingsWrapper {

    // 現在または保存する言語
    @AuraEnabled
    public String language { get; set; }
    // 現在または保存する地域
    @AuraEnabled
    public String locale { get; set; }
    // 言語コードと表示名
    @AuraEnabled
    public Map<String, String> languages { get; set; }
    // 地域コードと表示名
    @AuraEnabled
    public Map<String, String> locales { get; set; }
    // 利用者権限での編集可否
    @AuraEnabled
    public Boolean canEdit;
    // 想定可能な失敗の案内
    @AuraEnabled
    public String errorMessage { get; set; }
    // サーバー内部だけで使用する更新対象
    public User record { get; set; }

    /** 空の設定と処理結果を初期化 */
    public UserLocaleSettingsWrapper() {
        // 未取得の言語を明示
        this.language = '';
        // 未取得の地域を明示
        this.locale = '';
        // 言語候補を初期化
        this.languages = new Map<String, String>();
        // 地域候補を初期化
        this.locales = new Map<String, String>();
        // 権限確認前の編集を禁止
        this.canEdit = false;
        // 正常な初期状態を設定
        this.errorMessage = '';
        // 未検証の更新対象を空にする
        this.record = new User();
    }
}
