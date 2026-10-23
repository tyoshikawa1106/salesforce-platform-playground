/**
 * 固定範囲の階層一覧要求
 */
public with sharing class OrgExplorerPageRequest {

    // 要求との対応キー
    @AuraEnabled
    public String requestId { get; set; }
    // MANAGERまたはROLE
    @AuraEnabled
    public String mode { get; set; }
    // 一覧の固定範囲
    @AuraEnabled
    public String scope { get; set; }
    // 親のID、ルートでは未指定
    @AuraEnabled
    public Id parentId { get; set; }
    // 無効ユーザーを含めるかどうか
    // 公開DTOの自動setterであり、処理を切り替えるBoolean引数には該当しない
    @SuppressWarnings('PMD.AvoidBooleanMethodParameters')
    @AuraEnabled
    public Boolean includeInactive { get; set; }
    // 前回応答のページ境界
    @AuraEnabled
    public String cursor { get; set; }

    // ユーザー一覧専用の標準カーソル
    @AuraEnabled
    public Database.PaginationCursor paginationCursor { get; set; }
    // 標準カーソル内の取得開始位置
    @AuraEnabled
    public Integer startIndex { get; set; }

    // 一覧の取得件数、省略時は50件
    @AuraEnabled
    public Integer pageSize { get; set; }

    /**
     * 階層一覧の取得条件を未指定で初期化
     */
    public OrgExplorerPageRequest() {
        // 要求との対応キーを初期化
        this.requestId = '';
        // MANAGERまたはROLEを初期化
        this.mode = '';
        // 一覧の固定範囲を初期化
        this.scope = '';
        // 親のID、ルートでは未指定を初期化
        this.parentId = null;
        // 無効ユーザーを含めるかどうかを初期化
        this.includeInactive = false;
        // 前回応答のページ境界を初期化
        this.cursor = '';
        // ユーザー一覧は標準カーソル未発行の先頭位置から開始
        this.paginationCursor = null;
        // 先頭ページの取得位置を初期化
        this.startIndex = 0;
        // 通常の一覧表示に使う取得件数を初期化
        this.pageSize = 50;
    }
}