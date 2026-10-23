/**
 * 組織探索のモードと任意項目の参照可否
 */
public with sharing class OrgExplorerAccessPolicy {

    public Boolean usersEnabled;
    public Boolean managerEnabled;
    public Boolean rolesEnabled;
    public Boolean membershipEnabled;
    public Boolean titleEnabled;
    public Boolean departmentEnabled;
    public Boolean emailEnabled;
    public Boolean employeeNumberEnabled;
    public Boolean profileEnabled;

    /**
     * 各オブジェクトと照会に使用する項目を確認
     */
    public OrgExplorerAccessPolicy() {
        // 標準Userの参照前提をまとめて評価
        Map<String, Schema.SObjectField> userFields = User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
            .fields.getMap();
        // 氏名と有効状態を読めなければユーザーを表示しない
        this.usersEnabled =
            User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible() &&
            canRead(userFields, 'Id') &&
            canRead(userFields, 'Name') &&
            canRead(userFields, 'IsActive');
        // 上司階層の照会条件にも項目権限を適用
        this.managerEnabled = this.usersEnabled && canRead(userFields, 'ManagerId');
        // ロール所属と上司関係を別々に判定
        this.membershipEnabled = this.usersEnabled && canRead(userFields, 'UserRoleId');
        // 任意項目は許可された場合だけSELECTに含める
        this.titleEnabled = this.usersEnabled && canRead(userFields, 'Title');
        // 部署の未登録と権限不足を区別
        this.departmentEnabled = this.usersEnabled && canRead(userFields, 'Department');
        // メール列は参照権限がある場合だけ提供
        this.emailEnabled = this.usersEnabled && canRead(userFields, 'Email');
        // 従業員番号は一覧に必要な場合だけ取得
        this.employeeNumberEnabled = this.usersEnabled && canRead(userFields, 'EmployeeNumber');
        // 関連先の名称まで参照できる場合だけプロファイル列を提供
        this.profileEnabled =
            this.usersEnabled &&
            canRead(userFields, 'ProfileId') &&
            Profile.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible() &&
            Profile.Name.getDescribe().isAccessible();
        // ロール構造の可視性はUserの共有から推定しない
        Map<String, Schema.SObjectField> roleFields = UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
            .fields.getMap();
        // 親項目を含む必須参照を確認
        this.rolesEnabled =
            UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible() &&
            canRead(roleFields, 'Id') &&
            canRead(roleFields, 'Name') &&
            canRead(roleFields, 'ParentRoleId');
    }

    /**
     * 許可された標準User項目だけを照会用に選択
     * @param scope MANAGER_STRUCTURE、MANAGER_SEARCH、ROLE_MEMBERS、MANAGER_MEMBERS
     * @return サーバー定義の固定項目一覧
     */
    public List<String> getUserFields(String scope) {
        // 外部から項目名を受け取らず固定項目から組み立て
        List<String> fields = new List<String>{ 'Id', 'Name', 'IsActive' };
        // 一覧ではメール・プロファイルを追加し、候補では関係IDを取得しない
        Boolean members = new Set<String>{ 'ROLE_MEMBERS', 'MANAGER_MEMBERS' }.contains(scope);
        // 構造の接続と一覧の上司表示に必要な場合だけ取得
        if (scope != 'MANAGER_SEARCH' && this.managerEnabled) {
            fields.add('ManagerId');
        }
        // ロール名を表示する上司構造と上司メンバーだけで取得
        if (canReadRole(scope)) {
            fields.add('UserRoleId');
        }
        // 任意項目の非参照による照会失敗を防止
        if (this.titleEnabled) {
            fields.add('Title');
        }
        // 部署が許可されていない場合は取得しない
        if (this.departmentEnabled) {
            fields.add('Department');
        }
        // 一覧専用の任意項目へ同じ権限判定と取得順を適用
        if (members) {
            // 項目追加のたびに条件分岐を増やさず可否を対応させる
            Map<String, Boolean> readable = new Map<String, Boolean>{
                'Email' => this.emailEnabled,
                'EmployeeNumber' => this.employeeNumberEnabled,
                'ProfileId' => this.profileEnabled
            };
            // Mapの走査順に依存せず一覧専用の項目だけを追加
            for (String field : new List<String>{ 'Email', 'EmployeeNumber', 'ProfileId' }) {
                // 参照できない項目をSELECTへ含めない
                if (readable.get(field)) {
                    fields.add(field);
                }
            }
        }
        // 検証済み項目をSelectorへ引き渡し
        return fields;
    }

    /**
     * ロール名を表示する用途と参照権限を確認
     * @param scope 構造・候補・一覧の固定用途
     * @return 上司構造または上司メンバーでロール名を参照できる場合にtrue
     */
    public Boolean canReadRole(String scope) {
        // 構造・一覧・関連ID抽出に同じ公開条件を適用
        return new Set<String>{ 'MANAGER_STRUCTURE', 'MANAGER_MEMBERS' }.contains(scope) && this.membershipEnabled && this.rolesEnabled;
    }

    /**
     * 所属一覧に表示を許可する列を確定
     * @param scope ROLE_MEMBERSまたはMANAGER_MEMBERS
     * @return 参照可能な固定列キー
     */
    public List<String> getMemberColumns(String scope) {
        // 非表示項目を空列として公開しない
        List<String> columns = new List<String>();
        // 氏名を含め必須項目が読めない場合は空の契約
        if (!this.usersEnabled) {
            return columns;
        }
        // 許可された列だけを表示順に追加
        columns.add('label');
        // メールの参照権限を列にも適用
        if (this.emailEnabled) {
            columns.add('email');
        }
        // 部署の非参照を未登録と混同させない
        if (this.departmentEnabled) {
            columns.add('department');
        }
        // 役職を参照できる場合だけ公開
        if (this.titleEnabled) {
            columns.add('title');
        }
        // 上司の関連項目が参照可能な場合だけ公開
        if (this.managerEnabled) {
            columns.add('managerName');
        }
        // 両モードでプロファイルの直前へ従業員番号を表示
        if (this.employeeNumberEnabled) {
            columns.add('employeeNumber');
        }
        // 関連オブジェクトの参照権限も必要
        if (this.profileEnabled) {
            columns.add('profileName');
        }
        // 上司メンバーだけプロファイルの右隣へロール名を表示
        if (canReadRole(scope)) {
            columns.add('roleName');
        }
        // 有効状態はusersEnabledの必須参照項目として確認済み
        columns.add('isActive');
        // サーバーで確定した表示契約を返却
        return columns;
    }

    /**
     * 上司カードで参照可能な項目の表示ラベルを取得
     * @return Userの項目定義に従うラベル、非参照項目は含めない
     */
    public Map<String, String> getCardFieldLabels() {
        // 項目の値と同じ参照条件でラベルを公開
        List<String> fields = new List<String>();
        // 部署のラベルは利用者の言語設定に従う
        if (this.departmentEnabled) {
            fields.add('department');
        }
        // 役職の変更済みラベルも項目定義から取得
        if (this.titleEnabled) {
            fields.add('title');
        }
        // 関連ロールを参照できる場合だけ所属項目を表示
        if (this.membershipEnabled && this.rolesEnabled) {
            fields.add('role');
        }
        // 追加の照会を使わず機能情報へ渡す
        return getUserFieldLabels(fields);
    }

    /**
     * 一覧で参照可能な項目のSalesforceラベルを取得
     * @param scope ROLE_MEMBERSまたはMANAGER_MEMBERS
     * @return 固定見出しの関連列を除いた許可済みラベル
     */
    public Map<String, String> getMemberColumnLabels(String scope) {
        // 表示列と項目ラベルに同じ権限判定を適用
        return getUserFieldLabels(getMemberColumns(scope));
    }

    // カードと一覧で共用するUser項目の対応を一箇所に保持
    private Map<String, String> getUserFieldLabels(List<String> fields) {
        // 外部入力ではなく許可済み表示キーから項目定義を参照
        Map<String, Schema.SObjectField> definitions = new Map<String, Schema.SObjectField>{
            'label' => User.Name,
            'email' => User.Email,
            'department' => User.Department,
            'title' => User.Title,
            'employeeNumber' => User.EmployeeNumber,
            'isActive' => User.IsActive,
            'role' => User.UserRoleId
        };
        // 現在の利用者のラベルだけを新しい対応表で返却
        Map<String, String> labels = new Map<String, String>();
        // 参照不能項目や固定見出しの列を含めない
        for (String field : fields) {
            if (definitions.containsKey(field)) {
                labels.put(field, definitions.get(field).getDescribe().getLabel());
            }
        }
        // ラベル取得ではSOQLを使用しない
        return labels;
    }

    private Boolean canRead(Map<String, Schema.SObjectField> fields, String name) {
        // Describeで取得可能な項目だけを許可
        return fields.containsKey(name) && fields.get(name).getDescribe().isAccessible();
    }
}