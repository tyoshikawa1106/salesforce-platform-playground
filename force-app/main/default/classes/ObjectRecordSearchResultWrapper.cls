/**
 * 汎用レコード検索画面に返す検索結果 Wrapper
 */
public with sharing class ObjectRecordSearchResultWrapper {
    /**
     * 検索画面設定
     */
    @AuraEnabled
    public ObjectRecordSearchConfigWrapper config { get; private set; }

    /**
     * 一覧に表示するレコード行
     */
    @AuraEnabled
    public List<ObjectRecordSearchRowWrapper> records { get; private set; }

    /**
     * 1 ページあたりの最大表示件数
     */
    @AuraEnabled
    public Integer pageSize { get; private set; }

    /**
     * 現在のページ番号
     */
    @AuraEnabled
    public Integer pageNumber { get; private set; }

    /**
     * 次ページがあるかどうか
     */
    @AuraEnabled
    public Boolean hasNextPage { get; private set; }

    /**
     * 次ページ取得用のカーソルトークン
     */
    @AuraEnabled
    public String nextPageToken { get; private set; }

    /**
     * レコード検索結果を作成
     *
     * @param config 検索画面設定
     * @param records 一覧に表示するレコード行
     */
    public ObjectRecordSearchResultWrapper(
        ObjectRecordSearchConfigWrapper config,
        List<ObjectRecordSearchRowWrapper> records
    ) {
        this.config = config;
        this.records = records;
    }

    /**
     * 検索結果にページング状態反映
     *
     * @param pageSize 1 ページあたりの最大表示件数
     * @param pageNumber 現在のページ番号
     * @param nextPageToken 次ページ取得用のカーソルトークン
     * @return ページング状態を反映した検索結果
     */
    public ObjectRecordSearchResultWrapper withPageState(
        Integer pageSize,
        Integer pageNumber,
        String nextPageToken
    ) {
        // token の有無から次ページ表示状態を確定
        this.pageSize = pageSize;
        this.pageNumber = pageNumber;
        this.nextPageToken = nextPageToken;
        hasNextPage = String.isNotBlank(nextPageToken);
        return this;
    }
}
