/**
 * 汎用レコード検索画面に返す検索結果 Wrapper
 */
public with sharing class ObjectRecordSearchResultWrapper {

    // 検索画面設定
    @AuraEnabled
    public ObjectRecordSearchConfigWrapper config { get; private set; }

    // 一覧に表示するレコード行
    @AuraEnabled
    public List<ObjectRecordSearchRowWrapper> records { get; private set; }

    // 1 ページあたりの最大表示件数
    @AuraEnabled
    public Integer pageSize { get; private set; }

    // 現在のページ番号
    @AuraEnabled
    public Integer pageNumber { get; private set; }

    // 次ページがあるかどうか
    @AuraEnabled
    public Boolean hasNextPage { get; private set; }

    // 次ページ取得用のカーソルトークン
    @AuraEnabled
    public String nextPageToken { get; private set; }

    /**
     * レコード検索結果を作成
     *
     * @param config 検索画面設定
     * @param records 一覧に表示するレコード行
     */
    public ObjectRecordSearchResultWrapper(ObjectRecordSearchConfigWrapper config, List<ObjectRecordSearchRowWrapper> records) {
        // 検索画面設定と検索結果を同じレスポンスで返す
        this.config = config;
        // datatable に表示する行を返す
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
    public ObjectRecordSearchResultWrapper withPageState(Integer pageSize, Integer pageNumber, String nextPageToken) {
        // 画面側の件数表示と次ページ判定に使う
        this.pageSize = pageSize;
        // 画面側の現在ページ表示に使う
        this.pageNumber = pageNumber;
        // 次ページ取得ボタンのリクエストに使う
        this.nextPageToken = nextPageToken;
        // token の有無から次ページ表示状態を確定
        this.hasNextPage = String.isNotBlank(nextPageToken);
        return this;
    }
}
