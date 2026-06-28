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
     */
    public ObjectRecordSearchResultWrapper(
        ObjectRecordSearchConfigWrapper config,
        List<ObjectRecordSearchRowWrapper> records
    ) {
        this.config = config;
        this.records = records;
    }

    /**
     * 検索結果にページング状態を反映します。
     * ResultWrapper は LWC へ返す最終形だけを持ち、次ページ判定は Service 側で完了させます。
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
        this.pageSize = pageSize;
        this.pageNumber = pageNumber;
        this.nextPageToken = nextPageToken;
        hasNextPage = String.isNotBlank(nextPageToken);
        return this;
    }
}
