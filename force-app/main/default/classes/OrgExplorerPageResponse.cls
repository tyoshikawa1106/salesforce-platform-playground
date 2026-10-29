/**
 * 階層・メンバー一覧・検索候補の共通応答
 */
public with sharing class OrgExplorerPageResponse {

    // 表示可能なノード
    @AuraEnabled
    public List<Node> nodes { get; set; }
    // 可視ロールへ直接所属する参照可能ユーザー数、未集計は未登録
    @AuraEnabled
    public Map<Id, Integer> memberCounts { get; set; }
    // 上司カードの所属ロール名と参照状態、可視ユーザーIDのみをキーにする
    @AuraEnabled
    public Map<Id, Map<String, String>> cardRoles { get; set; }
    // 所属一覧で参照可能な列、空一覧でも列の権限を保持
    @AuraEnabled
    public List<String> memberColumns { get; set; }
    // 参照可能な列に対応するSalesforce項目ラベル
    @AuraEnabled
    public Map<String, String> memberColumnLabels { get; set; }
    // 後続ページがあるかどうか
    // 公開DTOの自動setterであり、処理を切り替えるBoolean引数には該当しない
    @SuppressWarnings('PMD.AvoidBooleanMethodParameters')
    @AuraEnabled
    public Boolean hasMore { get; set; }
    // 次ページの取得境界
    @AuraEnabled
    public String nextCursor { get; set; }

    // ユーザー一覧専用の標準カーソル
    @AuraEnabled
    public Database.PaginationCursor paginationCursor { get; set; }
    // 一覧カーソルの対象件数、構造の人数集計とは独立
    @AuraEnabled
    public Integer memberTotalCount { get; set; }
    // 標準カーソルが返した次の取得位置
    @AuraEnabled
    public Integer nextIndex { get; set; }
    // 取得上限に達した一覧の案内
    @AuraEnabled
    public String memberNotice { get; set; }

    /**
     * 一覧と候補を空のページで初期化
     */
    public OrgExplorerPageResponse() {
        // 表示可能なノードを初期化
        this.nodes = new List<Node>();
        // 応答間で列の権限を引き継がない
        this.memberColumns = new List<String>();
        // 列の権限と同じ応答だけに項目ラベルを保持
        this.memberColumnLabels = new Map<String, String>();
        // 未集計をゼロ件と混同しない空の対応表
        this.memberCounts = new Map<Id, Integer>();
        // カードの関連先情報を応答間で引き継がない
        this.cardRoles = new Map<Id, Map<String, String>>();
        // 後続ページがあるかどうかを初期化
        this.hasMore = false;
        // 次ページの取得境界を初期化
        this.nextCursor = '';
        // ユーザー一覧は標準カーソル未発行の先頭位置から開始
        this.paginationCursor = null;
        // 一覧カーソル未発行を0件と区別
        this.memberTotalCount = null;
        // 次の取得位置は成功時に標準APIから設定
        this.nextIndex = 0;
        // 上限の案内を応答間で引き継がない
        this.memberNotice = '';
    }
    /**
     * 組織図と階層リストへ公開する可視ノード
     */
    public class Node {

        // 表示集合の一意キー
        @AuraEnabled
        public String key { get; set; }
        // USER・ROLEの種別
        @AuraEnabled
        public String kind { get; set; }
        // 可視確認済みレコードのID
        @AuraEnabled
        public Id recordId { get; set; }
        // 表示名
        @AuraEnabled
        public String label { get; set; }
        // 可視確認済み親のキー
        @AuraEnabled
        public String parentKey { get; set; }
        // 有効ユーザーかどうか
        // 公開DTOの自動setterであり、処理を切り替えるBoolean引数には該当しない
        @SuppressWarnings('PMD.AvoidBooleanMethodParameters')
        @AuraEnabled
        public Boolean isActive { get; set; }
        // 参照を許可された役職
        @AuraEnabled
        public String title { get; set; }
        // 参照を許可された部署
        @AuraEnabled
        public String department { get; set; }
        // 役職の参照状態
        @AuraEnabled
        public String titleState { get; set; }
        // 部署の参照状態
        @AuraEnabled
        public String departmentState { get; set; }

        // 所属一覧で参照が許可されたメール
        @AuraEnabled
        public String email { get; set; }
        // 所属一覧で可視確認済みの上司、非参照時は未設定
        @AuraEnabled
        public Id managerId { get; set; }
        // 可視確認済みの上司名
        @AuraEnabled
        public String managerName { get; set; }
        // 所属一覧で参照が許可された従業員番号
        @AuraEnabled
        public String employeeNumber { get; set; }
        // 上司のメンバー一覧で可視確認済みのロール名
        @AuraEnabled
        public String roleName { get; set; }
        // 可視確認済みのプロファイル名
        @AuraEnabled
        public String profileName { get; set; }

        /**
         * 未接続の表示ノードを初期化
         */
        public Node() {
            // 表示集合の一意キーを初期化
            this.key = '';
            // USER・ROLEの種別を初期化
            this.kind = '';
            // 可視確認済みレコードのIDを初期化
            this.recordId = null;
            // 表示名を初期化
            this.label = '';
            // 可視確認済み親のキーを初期化
            this.parentKey = '';
            // 有効ユーザーかどうかを初期化
            this.isActive = false;
            // 参照を許可された役職を初期化
            this.title = '';
            // 参照を許可された部署を初期化
            this.department = '';
            // 役職の参照状態を初期化
            this.titleState = 'NOT_APPLICABLE';
            // 部署の参照状態を初期化
            this.departmentState = 'NOT_APPLICABLE';
            // 未許可の任意項目は空値に統一
            this.email = '';
            // 関連先を未確認のまま名称を補完しない
            this.managerName = '';
            // 従業員番号の未登録と非参照は空欄に統一
            this.employeeNumber = '';
            // 未確認の関連先IDを返却しない
            this.managerId = null;
            // プロファイルは所属一覧でだけ設定
            this.profileName = '';
            // ロール名は上司のメンバー一覧でだけ設定
            this.roleName = '';
        }
    }
}