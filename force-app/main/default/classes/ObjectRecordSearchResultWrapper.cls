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

    // 次の操作へ引き継ぐ標準カーソル
    @AuraEnabled
    public Database.PaginationCursor paginationCursor { get; private set; }

    // 標準APIが返した次の取得位置
    @AuraEnabled
    public Integer nextIndex { get; private set; }

    // 標準カーソルの取得上限に達した場合の案内判定
    @AuraEnabled
    public Boolean isResultLimitReached { get; private set; }

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
        this.records = records ?? new List<ObjectRecordSearchRowWrapper>();
        // ページ状態を後から設定しない呼び出しでも安定した既定値を返す
        this.pageSize = 0;
        this.pageNumber = 1;
        this.hasNextPage = false;
        this.nextIndex = 0;
        this.isResultLimitReached = false;
    }

    /**
     * 検索結果にページング状態反映
     *
     * @param pageNumber 現在のページ番号
     * @param paginationCursor 標準カーソル
     * @param nextIndex 標準APIの次ページ位置
     * @return ページング状態を反映した検索結果
     */
    public ObjectRecordSearchResultWrapper withPageState(Integer pageNumber, Database.PaginationCursor paginationCursor, Integer nextIndex) {
        // 画面側の件数表示と次ページ判定に使う
        this.pageSize = ObjectRecordSearchQueryPlan.SEARCH_FETCH_SIZE;
        // 画面側の現在ページ表示に使う
        this.pageNumber = pageNumber ?? 1;
        // 次ページ取得ボタンのリクエストに使う
        this.paginationCursor = paginationCursor;
        // 取得結果の位置をそのまま保持
        this.nextIndex = nextIndex ?? 0;
        // 上限到達時には全件表示と誤解させない案内を返す
        this.isResultLimitReached = paginationCursor != null && paginationCursor.getNumRecords() >= 100000;
        // 標準カーソルの件数と取得位置から次ページ表示状態を確定
        this.hasNextPage = paginationCursor != null && this.nextIndex > 0 && this.nextIndex < paginationCursor.getNumRecords();
        return this;
    }
}