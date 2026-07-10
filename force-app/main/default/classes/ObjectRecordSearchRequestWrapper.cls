/**
 * 汎用レコード検索画面から Apex に渡す検索リクエスト Wrapper
 */
public with sharing class ObjectRecordSearchRequestWrapper {
    /**
     * データボードカードの表示キー
     */
    @AuraEnabled
    public String metricKey { get; set; }

    /**
     * Name 項目に対する検索語
     */
    @AuraEnabled
    public String searchTerm { get; set; }

    /**
     * 次ページ取得用のカーソルトークン
     */
    @AuraEnabled
    public String pageToken { get; set; }

    /**
     * 一覧のソート項目
     */
    @AuraEnabled
    public String sortBy { get; set; }

    /**
     * 一覧のソート方向
     */
    @AuraEnabled
    public String sortDirection { get; set; }

    /**
     * 画面表示用のページ番号
     */
    @AuraEnabled
    public Integer pageNumber { get; set; }
}
