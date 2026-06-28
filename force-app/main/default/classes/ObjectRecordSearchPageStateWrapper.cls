/**
 * 汎用レコード検索画面のページ状態 Wrapper です。
 */
public with sharing class ObjectRecordSearchPageStateWrapper {
    /**
     * 1 ページあたりの最大表示件数です。
     */
    public Integer pageSize { get; set; }

    /**
     * 現在のページ番号です。
     */
    public Integer pageNumber { get; set; }

    /**
     * 次ページ取得用のカーソルトークンです。
     */
    public String nextPageToken { get; set; }
}
