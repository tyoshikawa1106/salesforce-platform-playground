/**
 * 組織探索のユーザーノード・メンバー一覧・関連先の変換
 */
public with sharing class OrgExplorerMemberService {

    /**
     * 可視Userを公開ノードに変換
     * @param record 可視性確認済みのUser
     * @param access 任意項目の参照可否
     * @return 関係先IDとメールを含まないノード
     */
    public OrgExplorerPageResponse.Node createUserNode(User record, OrgExplorerAccessPolicy access) {
        // 生のSObjectを画面へ返さない
        OrgExplorerPageResponse.Node node = new OrgExplorerPageResponse.Node();
        // 見えるレコードだけを識別可能にする
        node.key = 'USER:' + record.Id;
        // ノード種別を明示
        node.kind = 'USER';
        // レコード移動用に可視IDを設定
        node.recordId = record.Id;
        // 氏名の未設定を空文字へ統一
        node.label = record.Name ?? '';
        // 有効状態は標準項目の値を使用
        node.isActive = record.IsActive == true;
        // 任意の役職は参照を許可されたときだけコピー
        node.title = access.titleEnabled ? (record.Title ?? '') : '';
        // 部署も参照可否を反映
        node.department = access.departmentEnabled ? (record.Department ?? '') : '';
        // 権限なしと未登録を区別
        node.titleState = getFieldState(access.titleEnabled, node.title);
        // 部署の参照状態を保持
        node.departmentState = getFieldState(access.departmentEnabled, node.department);
        // 関係先の可視性を確認するまで親を設定しない
        return node;
    }

    /**
     * 項目の参照状態を区別
     * @param canRead 項目を参照できる場合にtrue
     * @param value 取得済み値
     * @return VALUE・EMPTY・UNAVAILABLE
     */
    private String getFieldState(Boolean canRead, String value) {
        // 非参照の値を未登録として扱わない
        if (canRead != true) {
            return 'UNAVAILABLE';
        }
        // 判定ごとの項目対応表を生成しない
        return String.isBlank(value) ? 'EMPTY' : 'VALUE';
    }

    /**
     * 可視Userから詳細用の上司照会対象を抽出
     * @param records 可視確認済みの対象User
     * @param access 上司項目の参照権限
     * @return 次に可視性を確認するID集合
     */
    public Set<Id> getManagerIds(List<User> records, OrgExplorerAccessPolicy access) {
        // 項目を読む前の権限判定と未設定除外を共用
        return getRelatedUserIds(records, access.managerEnabled, 'ManagerId');
    }

    /**
     * 可視Userから所属ロールの照会対象を抽出
     * @param records 可視確認済みの対象User
     * @param access 所属とロール構造の参照権限
     * @param scope 構造・候補・一覧の固定用途
     * @return 次に可視性を確認するID集合
     */
    public Set<Id> getRoleIds(List<User> records, OrgExplorerAccessPolicy access, String scope) {
        // 所属とロール構造の両方を参照できる場合だけ抽出
        return getRelatedUserIds(records, access.canReadRole(scope), 'UserRoleId');
    }

    /**
     * 一ページと可視確認済み関連先を受け渡す照会結果
     */
    public class MemberPageData {

        public List<User> records;
        public Map<Id, User> managers;
        public Map<Id, Profile> profiles;
        public Map<Id, UserRole> roles = new Map<Id, UserRole>();
        public Database.PaginationCursor paginationCursor;
        public Database.CursorFetchResult fetched;

        /**
         * まとめて照会した結果を保持
         * @param records 所属ユーザー
         * @param managers 参照可能な上司
         * @param profiles 参照可能なプロファイル
         */
        public MemberPageData(List<User> records, List<User> managers, List<Profile> profiles) {
            // 一覧と関連先を同じ要求の結果に限定
            this.records = records;
            // 見えない関連先を名前で補完しない
            this.managers = new Map<Id, User>(managers);
            // 参照できたプロファイルだけを索引化
            this.profiles = new Map<Id, Profile>(profiles);
        }
    }

    /**
     * 可視性確認済みの取得結果から新しい所属一覧を生成
     * @param wrapper 同じページの可視確認済み照会結果
     * @param request 可視な親と取得条件
     * @param access 現在の項目権限
     * @return 入力レコードを変更しない新しいページ応答
     */
    public OrgExplorerPageResponse createMemberPage(
        MemberPageData wrapper,
        OrgExplorerPageRequest request,
        OrgExplorerAccessPolicy access
    ) {
        // 入力の応答やカーソルを書き換えない
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // 一覧の継続位置は標準APIが返した位置だけを使用
        response.paginationCursor = wrapper.paginationCursor;
        // 空集合では取得位置を進めない
        response.nextIndex = wrapper.fetched?.getNextIndex() ?? 0;
        // 単体変換ではカーソルなしを許容し、公開APIでは標準カーソルを必須とする
        if (wrapper.paginationCursor != null) {
            // 一覧の結果集合から総件数を得て追加照会を避ける
            response.memberTotalCount = wrapper.paginationCursor.getNumRecords();
            // isDone単独では最終ページを判定しない
            response.hasMore = response.nextIndex > 0 && response.nextIndex < response.memberTotalCount;
            // 上限到達を全件取得と誤認させない
            response.memberNotice = response.memberTotalCount >= 100000 ? '一覧は最大100,000件まで表示します。' : '';
        }
        // ゼロ件でも現在の権限に対応する列とラベルを返す
        response.memberColumns = access.getMemberColumns(request.scope);
        response.memberColumnLabels = access.getMemberColumnLabels(request.scope);
        // 基本項目と関連先を同じ走査で組み立てる
        response.nodes = createMemberNodes(wrapper, request, access);
        // 入力を変更せず新しい応答だけを返す
        return response;
    }

    // 一覧の基本項目・関係・関連先を指定件数以内で一度だけ変換
    private List<OrgExplorerPageResponse.Node> createMemberNodes(
        MemberPageData wrapper,
        OrgExplorerPageRequest request,
        OrgExplorerAccessPolicy access
    ) {
        // ロール名の公開条件は一覧全体で一度だけ確認
        Boolean showRole = access.canReadRole(request.scope);
        // 入力レコードを変更しない新しい表示集合
        List<OrgExplorerPageResponse.Node> nodes = new List<OrgExplorerPageResponse.Node>();
        // 境界件数はレコードごとに再計算しない
        Integer limitCount = Math.min(request.pageSize ?? 50, wrapper.records.size());
        // 標準カーソルの順序で一度だけ走査
        for (Integer index = 0; index < limitCount; index++) {
            // 元のレコードをそのまま公開しない
            User record = wrapper.records[index];
            // 氏名・部署・役職はカードと同じ変換を利用
            OrgExplorerPageResponse.Node node = createUserNode(record, access);
            // 取得していないメール項目には触れない
            if (access.emailEnabled) {
                // 未登録の文字列を空欄へ統一
                node.email = record.Email ?? '';
            }
            // 上司は一度だけ対応表を参照し、氏名とリンク先を揃える
            if (access.managerEnabled) {
                User manager = wrapper.managers.get(record.ManagerId);
                // 参照できない関連先名も空欄へ統一
                node.managerName = manager?.Name ?? '';
                node.managerId = manager?.Id;
            }
            // 一覧に限って許可済みの従業員番号を返す
            if (access.employeeNumberEnabled) {
                node.employeeNumber = record.EmployeeNumber ?? '';
            }
            // 可視確認済みのプロファイル名だけを返す
            if (access.profileEnabled) {
                // 関連先を取得できない場合は空欄を返す
                node.profileName = wrapper.profiles.get(record.ProfileId)?.Name ?? '';
            }
            // 上司メンバーの可視確認済みロール名だけを返す
            if (showRole) {
                node.roleName = wrapper.roles.get(record.UserRoleId)?.Name ?? '';
            }
            // 別の走査で同じ行を補足し直さない
            nodes.add(node);
        }
        // 指定件数以内の新規ノードだけを返す
        return nodes;
    }

    /**
     * ページに必要なプロファイルを重複排除
     * @param records 所属一覧の取得結果
     * @param access 現在の参照権限
     * @return 参照許可された関連IDの集合
     */
    public Set<Id> getProfileIds(List<User> records, OrgExplorerAccessPolicy access) {
        // 関連先の種類によらず同じ抽出規則を使用
        return getRelatedUserIds(records, access.profileEnabled, 'ProfileId');
    }

    // 固定の関連項目だけを、参照可否の確認後に抽出
    private Set<Id> getRelatedUserIds(List<User> records, Boolean canRead, String fieldName) {
        // 参照不能な項目へアクセスする前に全件を短絡
        Set<Id> ids = new Set<Id>();
        if (canRead != true) {
            return ids;
        }
        // レコードごとに共通の権限を判定し直さない
        for (User record : records) {
            ids.add((Id) record.get(fieldName));
        }
        // 未設定は問い合わせ対象へ含めない
        ids.remove(null);
        // 項目名はこのクラス内の固定呼び出しに限定
        return ids;
    }

    /**
     * 標準取得結果に含まれるIDだけを再照会対象にする
     * @param fetched 標準ページ、空集合ではnull
     * @return 最大50件のID
     */
    public Set<Id> getMemberIds(Database.CursorFetchResult fetched) {
        // 空カーソルも同じID索引の生成へ渡す
        List<SObject> records = fetched?.getRecords() ?? new List<SObject>();
        // 標準取得結果のIDだけを問い合わせ対象にする
        return new Map<Id, SObject>(records).keySet();
    }

    /**
     * 再確認済みユーザーを標準カーソルの順序へ対応
     * @param fetched 標準APIのページ
     * @param records 現在の条件で再確認済みのレコード
     * @return 参照できたレコードだけを持つ新しい一覧
     */
    public List<User> orderMemberRecords(Database.CursorFetchResult fetched, List<User> records) {
        // 取得時点の可視ユーザーだけを索引化
        Map<Id, User> visible = new Map<Id, User>(records);
        // 入力を変更せず標準カーソルの並びへ戻す
        List<User> ordered = new List<User>();
        // 空カーソルは空集合に揃え、走査を入れ子にしない
        List<SObject> fetchedRecords = fetched?.getRecords() ?? new List<SObject>();
        // 氏名が途中で変わっても標準カーソル内の位置を維持
        for (SObject record : fetchedRecords) {
            // 現在も可視なレコードだけを対応付ける
            User current = visible.get((Id) record.get('Id'));
            // 不足はControllerで条件変更として扱う
            if (current != null) {
                ordered.add(current);
            }
        }
        // 入力レコードの順序は変更しない
        return ordered;
    }
}