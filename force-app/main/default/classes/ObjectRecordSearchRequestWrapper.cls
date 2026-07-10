/**
 * 汎用レコード検索画面から Apex に渡す検索リクエスト Wrapper です。
 */
public with sharing class ObjectRecordSearchRequestWrapper {
    /**
     * データボードカードの表示キーです。
     */
    @AuraEnabled
    public String metricKey { get; set; }

    /**
     * Name 項目に対する検索語です。
     */
    @AuraEnabled
    public String searchTerm { get; set; }

    /**
     * 次ページ取得用のカーソルトークンです。
     */
    @AuraEnabled
    public String pageToken { get; set; }

    /**
     * 一覧のソート項目です。
     */
    @AuraEnabled
    public String sortBy { get; set; }

    /**
     * 一覧のソート方向です。
     */
    @AuraEnabled
    public String sortDirection { get; set; }

    /**
     * 画面表示用のページ番号です。
     */
    @AuraEnabled
    public Integer pageNumber { get; set; }
}
