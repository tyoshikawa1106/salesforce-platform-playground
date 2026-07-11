/**
 * 汎用レコード検索画面から Apex に渡す検索リクエスト Wrapper
 */
public with sharing class ObjectRecordSearchRequestWrapper {

    // データボードカードの表示キー
    @AuraEnabled
    public String metricKey { get; set; }

    // Name 項目に対する検索語
    @AuraEnabled
    public String searchTerm { get; set; }

    // 次ページ取得用のカーソルトークン
    @AuraEnabled
    public String pageToken { get; set; }

    // 一覧のソート項目
    @AuraEnabled
    public String sortBy { get; set; }

    // 一覧のソート方向
    @AuraEnabled
    public String sortDirection { get; set; }

    // 画面表示用のページ番号
    @AuraEnabled
    public Integer pageNumber { get; set; }

    /**
     * 検索リクエストの既定値を作成
     */
    public ObjectRecordSearchRequestWrapper() {
        // 未選択状態でも検索対象の検証へ進める
        this.metricKey = '';
        // 初期表示では名称検索条件を付けない
        this.searchTerm = '';
        // 初期表示では先頭ページから取得する
        this.pageToken = '';
        // 初期表示では既定の表示項目で並べる
        this.sortBy = '';
        // 初期表示の並び順を昇順に固定
        this.sortDirection = 'asc';
        // ページ表示を先頭ページから開始
        this.pageNumber = 1;
    }
}