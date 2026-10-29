/**
 * 組織探索のロール・上司構造と候補・人数の生成
 */
public with sharing class OrgExplorerService {

    // 本番の固定上限と、少量データの境界テストで共用する件数
    private final Integer structurePageSize;
    // ロール候補の公開上限を構造取得から独立して管理
    private final Integer roleCandidateLimit;

    /**
     * 通常のロール・上司構造取得に合わせて上限を固定
     */
    public OrgExplorerService() {
        // 通常入口から取得上限を変更させない
        structurePageSize = 1000;
        // 候補は両モードの標準表示件数に合わせる
        roleCandidateLimit = 50;
    }

    /**
     * 同じ構造変換の境界を少量データで検証する内部生成
     * @param structurePageSize ロール・上司構造の正の取得上限、テストだけで指定可能
     * @param roleCandidateLimit ロール候補の正の表示上限、テストだけで指定可能
     */
    @TestVisible
    private OrgExplorerService(Integer structurePageSize, Integer roleCandidateLimit) {
        // 可変の共有状態やテスト実行判定を使わず、インスタンスごとに固定
        this.structurePageSize = structurePageSize;
        // 本番と同じ候補変換を少量データで確認
        this.roleCandidateLimit = roleCandidateLimit;
    }

    /**
     * 可視ロールを公開ノードに変換
     * 内部変換の結果を同名Testから直接確認するためTestVisibleを指定
     * @param record 可視性確認済みロール
     * @return ユーザーとは異なる種別のノード
     */
    @TestVisible
    private OrgExplorerPageResponse.Node createRoleNode(UserRole record) {
        // ロールの種別と名前だけを公開
        OrgExplorerPageResponse.Node node = new OrgExplorerPageResponse.Node();
        // UserのIDと衝突しないキーを使用
        node.key = 'ROLE:' + record.Id;
        // 役職と同一視しない種別を設定
        node.kind = 'ROLE';
        // 取得済みIDだけを公開
        node.recordId = record.Id;
        // ロールの表示名を設定
        node.label = record.Name ?? '';
        // 親は別途可視性確認後に接続
        return node;
    }

    /**
     * ページ要求から継続値の検証条件を生成
     * @param request 検証済み要求
     * @return 発行先と範囲を固定した継続情報
     */
    public OrgExplorerCursorCodec.Cursor createPageCursor(OrgExplorerPageRequest request) {
        // 有効期間と版の既定値を使用
        OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerCursorCodec.Cursor();
        // 発行先を現在利用者へ固定
        cursor.viewerId = UserInfo.getUserId();
        // 用途の流用を拒否するため分類
        cursor.purpose = 'PAGE';
        // モードを範囲と一緒に固定
        cursor.mode = request.mode;
        // 一覧の種類を保持
        cursor.scope = request.scope;
        // 親は呼び出し元で可視確認済み
        cursor.parentId = request.parentId;
        // 有効条件の切替で再利用できないよう保持
        cursor.includeInactive = request.includeInactive == true;
        // 継続情報を呼び出し元へ返却
        return cursor;
    }

    /**
     * 構造ページと可視性確認済みの関連先を受け渡す照会結果
     */
    public class ManagerPageData {

        public List<AggregateResult> groups;
        public List<User> records;
        public List<User> parents;
        public List<UserRole> roles;

        /**
         * 構造ページを保持して関連先を空集合で初期化
         * @param groups 上司ごとの直属部下数
         * @param records 可視確認済みの上司
         */
        public ManagerPageData(List<AggregateResult> groups, List<User> records) {
            // 人数を可視ノードへ対応させる元データを保持
            this.groups = groups;
            // 先読みを除く公開対象ユーザーを保持
            this.records = records;
            // 親の可視性を確認するまで接続先を補完しない
            this.parents = new List<User>();
            // ロールを参照できない場合は空集合を維持
            this.roles = new List<UserRole>();
        }
    }

    /**
     * 集計の先読みを除いて可視性確認に必要な候補IDを抽出
     * @param groups 上司ごとの集計
     * @param size 公開候補の最大件数
     * @return 可視性を確認する上司ID
     */
    public Set<Id> getManagerGroupIds(List<AggregateResult> groups, Integer size) {
        // 公開前の可視性確認に使用するIDだけを保持
        Set<Id> ids = new Set<Id>();
        // 先読み行を表示候補から除外
        for (Integer index = 0; index < Math.min(size, groups.size()); index++) {
            ids.add((Id) groups[index].get('managerId'));
        }
        // 任意のユーザーを追加せず集計対象だけを返す
        return ids;
    }

    /**
     * 可視な上司の親・人数・所属ロールを公開ノードへ対応
     * @param wrapper 構造ページと可視性確認済みの関連先
     * @param request 表示条件と継続境界
     * @param access 現在の項目権限
     * @return 関連先の非公開情報を含まない構造ページ
     */
    public OrgExplorerPageResponse createManagerStructure(
        ManagerPageData wrapper,
        OrgExplorerPageRequest request,
        OrgExplorerAccessPolicy access
    ) {
        // 現在のページで参照できた上司だけを変換
        List<User> records = wrapper.records;
        // 人数は同じ表示条件で取得済みの集計を使用
        List<AggregateResult> groups = wrapper.groups;
        // 先読みの判定を可視性確認と継続応答で共用
        Boolean hasMore = groups.size() > structurePageSize;
        // 非公開IDをカーソルに含めず、部分的な構造の完了を偽らない
        if (records.isEmpty() && hasMore) {
            // 非可視のIDや途中の構造を返さず、公開例外として通知
            throw OrgExplorerAccessPolicy.createException('ACCESS_DENIED');
        }
        // 親の可視性は上司本人の参照とは別に確認
        Set<Id> visibleParents = new Map<Id, User>(wrapper.parents).keySet();
        // 関連先をユーザーごとに検索し直さず索引化
        Map<Id, UserRole> roleMap = new Map<Id, UserRole>(wrapper.roles);
        // ロールと上司で同じ集計結果の変換を共用
        Map<Id, Integer> counts = getMemberCounts(groups, 'managerId');
        // 別の要求の可視情報を引き継がない応答を生成
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // カードと一覧でユーザーの公開項目を揃える
        OrgExplorerMemberService members = new OrgExplorerMemberService();
        // 上司本人の可視性を確認済みの行だけを変換
        for (User record : records) {
            // 参照不能な任意項目を共通変換で除去
            OrgExplorerPageResponse.Node node = members.createUserNode(record, access);
            // 参照できた親だけを共通の接続処理へ渡す
            connectVisibleParent(node, record.ManagerId, visibleParents);
            // 所属の項目権限と関連ロールの可視性を別々に適用
            response.cardRoles.put(record.Id, createManagerRole(record, roleMap, access));
            // 可視ユーザーだけを構造へ追加
            response.nodes.add(node);
            // 直属部下の集計を公開ノードへ対応
            response.memberCounts.put(record.Id, counts.get(record.Id));
        }
        // 先読みがあり可視な境界を公開できる場合だけ継続
        response.hasMore = hasMore;
        // 不可視の集計IDを次ページの境界へ使用しない
        if (response.hasMore) {
            // 利用者と表示条件に固定された継続情報を作成
            OrgExplorerCursorCodec.Cursor next = createPageCursor(request);
            // 最後に公開した可視ユーザーだけを境界にする
            next.lastId = records[records.size() - 1].Id;
            // 次ページでも境界と条件を再検証できる形式へ変換
            response.nextCursor = new OrgExplorerCursorCodec().encode(next);
        }
        // 可視性を確認した応答だけを公開
        return response;
    }

    // 所属項目と関連先の両方を参照できる場合だけロール名を公開
    private Map<String, String> createManagerRole(
        User record,
        Map<Id, UserRole> roleMap,
        OrgExplorerAccessPolicy access
    ) {
        // 関係項目かロール構造を読めなければ項目自体を非表示にする
        if (!access.membershipEnabled || !access.rolesEnabled) {
            return new Map<String, String>{ 'name' => '', 'state' => 'UNAVAILABLE' };
        }
        // 未設定を権限不足と区別
        if (record.UserRoleId == null) {
            return new Map<String, String>{ 'name' => '', 'state' => 'EMPTY' };
        }
        // 参照できない関連先の名称を推測しない
        UserRole role = roleMap.get(record.UserRoleId);
        // 可視名称とその参照状態を同時に返却
        return new Map<String, String>{ 'name' => role?.Name ?? '', 'state' => role == null ? 'UNAVAILABLE' : 'VALUE' };
    }

    /**
     * 上司候補を可視性の再確認後に公開
     * @param wrapper 集計候補と可視確認済みの上司
     * @param access 現在の項目権限
     * @return 最大50人の候補
     */
    public OrgExplorerPageResponse createManagerSearchResults(
        OrgExplorerService.ManagerPageData wrapper,
        OrgExplorerAccessPolicy access
    ) {
        // 別の要求の可視情報を引き継がない応答を生成
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // 候補の先読みから追加の絞り込み要否を通知
        response.hasMore = wrapper.groups.size() > 50;
        // 候補もカードと同じユーザー項目の公開規則を使用
        OrgExplorerMemberService members = new OrgExplorerMemberService();
        // 関係先や個人メールを候補へ含めない
        for (User record : wrapper.records) {
            response.nodes.add(members.createUserNode(record, access));
        }
        // 可視性を確認した応答だけを公開
        return response;
    }

    // ロール構造・候補・直接所属人数
    /**
     * 構造ページの外にある親だけを可視確認対象にする
     * @param records 先読み行を含む参照可能ロール
     * @return まだ可視性を確認していない親の集合
     */
    public Set<Id> getUnloadedRoleParentIds(List<UserRole> records) {
        // ページ内で参照できたIDを共用
        Set<Id> visibleIds = new Set<Id>(new Map<Id, UserRole>(records).keySet());
        // 親ごとの照会を行わない対応表
        Set<Id> parentIds = new Set<Id>();
        // 先読み一件の親は公開しない
        for (Integer index = 0; index < Math.min(structurePageSize, records.size()); index++) {
            // 現在行の親関係を取り出す
            Id parentId = records[index].ParentRoleId;
            // 先読みを除いた行の親を候補へまとめる
            parentIds.add(parentId);
        }
        // 未設定と取得済みの親を集合演算で除外
        parentIds.remove(null);
        parentIds.removeAll(visibleIds);
        // 最大1000個の親をまとめて確認
        return parentIds;
    }

    /**
     * 参照可能な構造を1000ロール単位の応答へ変換
     * @param records 先読み一件を含む可視ロール
     * @param parents ページ外で可視確認できた親
     * @param request 起点と表示条件を検証済みの要求
     * @return 可視な親接続と次の構造取得位置
     */
    public OrgExplorerPageResponse createRolePage(
        List<UserRole> records,
        List<UserRole> parents,
        OrgExplorerPageRequest request
    ) {
        // ページ外の親を含む可視性の確認結果
        Set<Id> visibleIds = new Set<Id>(new Map<Id, UserRole>(records).keySet());
        // 関係IDだけで親が見えるとは判断しない
        visibleIds.addAll(new Map<Id, UserRole>(parents).keySet());
        // 今回のページに限った公開応答
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // 先読み一件から継続要否を判定
        response.hasMore = records.size() > structurePageSize;
        // 先読み行を表示ノードや集計対象に含めない
        for (Integer index = 0; index < Math.min(structurePageSize, records.size()); index++) {
            // 現在行を共通の公開ノードへ変換
            OrgExplorerPageResponse.Node node = createRoleNode(records[index]);
            // 現在行の親関係を取り出す
            Id parentId = records[index].ParentRoleId;
            // ロールと上司で同じ可視性の接続規則を使う
            connectVisibleParent(node, parentId, visibleIds);
            // 一括ページへ可視ノードを追加
            response.nodes.add(node);
        }
        // 一階層の終端ではなくID順ページの終端を使用
        if (response.hasMore) {
            // 表示条件と閲覧者に固定したカーソルを生成
            OrgExplorerCursorCodec.Cursor cursor = createPageCursor(request);
            // 最後に返した行だけを境界にする
            cursor.lastId = records[structurePageSize - 1].Id;
            // 次回も同じ起点と表示条件で検証する継続値
            response.nextCursor = new OrgExplorerCursorCodec().encode(cursor);
        }
        // 全体の上限ではなく次の取得位置を返す
        return response;
    }
    /**
     * 公開ページの可視ロールだけを集計対象にする
     * @param response 先読み行を除いたロールページ
     * @param access 現在の所属情報の参照可否
     * @return 構造ページ内の最大1000件の集計対象
     */
    public Set<Id> getMemberCountRoleIds(OrgExplorerPageResponse response, OrgExplorerAccessPolicy access) {
        // 構造の参照権限だけで所属人数を公開しない
        if (!access.membershipEnabled) {
            return new Set<Id>();
        }
        // 先読み行や別の枝を含めない
        Set<Id> ids = new Set<Id>();
        // 公開済みのロールだけを追加
        for (OrgExplorerPageResponse.Node node : response.nodes) {
            ids.add(node.recordId);
        }
        // 集計対象を返却
        return ids;
    }

    /**
     * 集計済みロールだけにゼロ件を含む人数を設定
     * @param roleIds 可視確認済みの集計対象
     * @param counts ユーザーモードの集計結果
     * @return 集計対象だけを含む新しい人数対応表
     */
    public Map<Id, Integer> createRoleMemberCounts(Set<Id> roleIds, List<AggregateResult> counts) {
        // 集計値の読み取りを上司構造と共用
        Map<Id, Integer> totals = getMemberCounts(counts, 'targetId');
        // 応答対象のロールだけに絞った新しい対応表
        Map<Id, Integer> memberCounts = new Map<Id, Integer>();
        // 取得済みで集計行のないロールだけゼロ件にする
        for (Id targetId : roleIds) {
            memberCounts.put(targetId, totals.get(targetId) ?? 0);
        }
        // 未取得のロールやその人数は公開しない
        return memberCounts;
    }

    // 固定の集計別名を使い、入力行を変更せずIDと人数へ変換
    private Map<Id, Integer> getMemberCounts(List<AggregateResult> groups, String idField) {
        // 呼び出し元が公開対象へ絞り込むための内部索引
        Map<Id, Integer> counts = new Map<Id, Integer>();
        // 同じCOUNTの変換をロールと上司で一度だけ実装
        for (AggregateResult groupRecord : groups) {
            counts.put((Id) groupRecord.get(idField), (Integer) groupRecord.get('memberCount'));
        }
        // 生のユーザーや集計外の情報を追加しない
        return counts;
    }

    // 新規ノードの未接続状態を維持し、可視確認済みの親だけを接続
    private void connectVisibleParent(OrgExplorerPageResponse.Node node, Id parentId, Set<Id> visibleIds) {
        // 関係IDがあるだけでは接続先を公開しない
        if (visibleIds.contains(parentId)) {
            // 呼び出し元で確定したノード種別を親にも使用
            node.parentKey = node.kind + ':' + parentId;
        }
    }

    /**
     * ロール候補を名称とIDだけの応答へ変換
     * @param records 上限判定の一件を含む可視ロール
     * @return 最大50候補と絞り込み要否
     */
    public OrgExplorerPageResponse createRoleSearchResults(List<UserRole> records) {
        // 過去の候補を混入させない
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // 全件数を集計せず絞り込み要否を通知
        response.hasMore = records.size() > roleCandidateLimit;
        // 先読み行を候補へ含めない
        for (Integer index = 0; index < Math.min(roleCandidateLimit, records.size()); index++) {
            // 関連先を含まない共通ノードで候補を返却
            response.nodes.add(createRoleNode(records[index]));
        }
        // 選択前の候補を返却
        return response;
    }

}
