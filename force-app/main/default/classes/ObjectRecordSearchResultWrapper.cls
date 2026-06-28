/**
 * 汎用レコード検索画面に返す検索結果 Wrapper です。
 */
public with sharing class ObjectRecordSearchResultWrapper {
    /**
     * 検索画面設定です。
     */
    @AuraEnabled
    public ObjectRecordSearchConfigWrapper config { get; private set; }

    /**
     * 一覧に表示するレコード行です。
     */
    @AuraEnabled
    public List<ObjectRecordSearchRowWrapper> records { get; private set; }

    /**
     * 1 ページあたりの最大表示件数です。
     */
    @AuraEnabled
    public Integer pageSize { get; private set; }

    /**
     * 現在のページ番号です。
     */
    @AuraEnabled
    public Integer pageNumber { get; private set; }

    /**
     * 次ページがあるかどうかです。
     */
    @AuraEnabled
    public Boolean hasNextPage { get; private set; }

    /**
     * 次ページ取得用のカーソルトークンです。
     */
    @AuraEnabled
    public String nextPageToken { get; private set; }

    /**
     * レコード検索結果を作成します。
     *
     * @param config 検索画面設定
     * @param records 一覧に表示するレコード行
     * @param pageState ページ状態
     */
    public ObjectRecordSearchResultWrapper(
        ObjectRecordSearchConfigWrapper config,
        List<ObjectRecordSearchRowWrapper> records,
        ObjectRecordSearchPageStateWrapper pageState
    ) {
        this.config = config;
        this.records = records;
        pageSize = pageState.pageSize;
        pageNumber = pageState.pageNumber;
        nextPageToken = pageState.nextPageToken;
        hasNextPage = String.isNotBlank(nextPageToken);
    }
}
