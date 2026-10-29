/**
 * 利用者権限を適用したUserとUserRoleの限定照会
 */
public with sharing class OrgExplorerSelector {

    /**
     * 対象Userの可視性を再確認
     * @param ids 必須の対象ID集合
     * @param fields AccessPolicyが許可した固定項目
     * @return 利用者から見える対象User
     */
    public List<User> selectUsers(Set<Id> ids, List<String> fields) {
        // 対象未指定で全Userを取得しない
        if (ids == null || ids.isEmpty()) {
            return new List<User>();
        }
        // 検索値はbindし、全照会にユーザーモードを明示
        List<User> records = Database.queryWithBinds(
            'SELECT ' + String.join(fields, ',') + ' FROM User WHERE Id IN :ids LIMIT 51',
            new Map<String, Object>{ 'ids' => ids },
            AccessLevel.USER_MODE
        );
        // SOQLの結果を加工せず返却
        return records;
    }

    /**
     * 対象ロールの可視性を再確認
     * @param ids 必須の対象ID集合
     * @param fields 呼び出し側が指定した固定の参照項目
     * @return 利用者から見える対象ロール
     */
    public List<UserRole> selectRoles(Set<Id> ids, List<String> fields) {
        // 対象未指定で全ロールを取得しない
        if (ids == null || ids.isEmpty()) {
            return new List<UserRole>();
        }
        // 親確認はIDだけ、カード表示は名称を含む固定項目を指定
        List<UserRole> records = Database.queryWithBinds(
            'SELECT ' + String.join(fields, ',') + ' FROM UserRole WHERE Id IN :ids LIMIT 1000',
            new Map<String, Object>{ 'ids' => ids },
            AccessLevel.USER_MODE
        );
        // 参照できたレコードだけを返却
        return records;
    }

    /**
     * 参照可能なロール構造を階層に依存しない順序で取得
     * @param lastId 前回ページの末尾、初回は未指定
     * @return 先読み一件を含む最大1001件
     */
    public List<UserRole> selectRoleStructurePage(Id lastId) {
        // 深さや親数に比例した照会を避ける固定順序
        String query = 'SELECT Id, Name, ParentRoleId FROM UserRole';
        // 初回と継続のキーセット境界を分離
        if (lastId != null) {
            query += ' WHERE Id > :lastId';
        }
        // 一要求のヒープと取得行数を制限
        query += ' ORDER BY Id ASC LIMIT 1001';
        // 他の枝も参照権限のある構造だけを索引として取得
        List<UserRole> records = Database.queryWithBinds(
            query,
            new Map<String, Object>{ 'lastId' => lastId },
            AccessLevel.USER_MODE
        );
        // 個別ロールへ分割せず取得結果を返す
        return records;
    }

    /**
     * 可視確認済みロールへの直接所属人数をまとめて集計
     * @param roleIds 可視確認済みの対象、最大1000件
     * @param request 現在の無効ユーザー表示条件
     * @return ユーザーモードで参照できるロール別人数
     */
    public List<AggregateResult> countRoleMembers(Set<Id> roleIds, OrgExplorerPageRequest request) {
        // 空集合やページ上限を超える範囲を集計しない
        if (roleIds.isEmpty() || roleIds.size() > 1000) {
            return new List<AggregateResult>();
        }
        // 個別ユーザーを読み込まずCOUNTだけを使用
        String query = 'SELECT UserRoleId targetId, COUNT(Id) memberCount FROM User WHERE UserRoleId IN :roleIds';
        // 一覧と同じ有効状態の条件を適用
        if (request.includeInactive != true) {
            query += ' AND IsActive = true';
        }
        // 集計結果の数を対象ロール数以内へ限定
        query += ' GROUP BY UserRoleId LIMIT 1000';
        // 共有と項目権限を集計にも適用
        List<AggregateResult> counts = Database.queryWithBinds(
            query,
            new Map<String, Object>{ 'roleIds' => roleIds },
            AccessLevel.USER_MODE
        );
        // 集計結果を公開応答へ変換せず返却
        return counts;
    }

    /**
     * 起点ロールを最上位・名称前方一致・API名完全一致で検索
     * @param term 正規化済み名称、空文字では最上位の候補
     * @param developerName 初期選択時のAPI名
     * @return 上限判定の一件を含む可視ロール候補
     */
    public List<UserRole> searchRoles(String term, String developerName) {
        // LIKEの制御文字を通常の名称として照合
        String pattern = term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%';
        // API名の初期値解決と通常の名称検索を分離
        String predicate = String.isNotEmpty(developerName) ? 'DeveloperName = :developerName' : 'Name LIKE :pattern';
        // 未入力では最上位ロールだけを取得
        if (String.isEmpty(term) && String.isEmpty(developerName)) {
            predicate = 'ParentRoleId = null';
        }
        // 利用者から見える候補だけを決定的な順序で取得
        List<UserRole> records = Database.queryWithBinds(
            'SELECT Id, Name FROM UserRole WHERE ' + predicate + ' ORDER BY Name, Id LIMIT 51',
            new Map<String, Object>{ 'pattern' => pattern, 'developerName' => developerName },
            AccessLevel.USER_MODE
        );
        // 親のIDや未取得の関連先を補完しない
        return records;
    }
    /**
     * 氏名順のユーザー一覧を標準カーソルとして作成
     * @param request 検証済みの親と表示条件
     * @return 利用者権限で作成した標準カーソル
     */
    public Database.PaginationCursor createMemberCursor(OrgExplorerPageRequest request) {
        // カーソルへ表示項目を保存せず、取得時の権限で再照会
        String query = 'SELECT Id FROM User WHERE ' + memberPredicate(request);
        // 同名の順序をIDで固定し、標準カーソルの取得上限へ限定
        query += ' ORDER BY Name ASC, Id ASC LIMIT 100000';
        // 表示対象を利用者権限で固定
        return Database.getPaginationCursorWithBinds(
            query,
            new Map<String, Object>{ 'parentId' => request.parentId },
            AccessLevel.USER_MODE
        );
    }

    /**
     * 標準APIでユーザーIDの一ページを取得
     * @param cursor 現在の標準カーソル
     * @param startIndex 標準APIの取得位置
     * @param fetchSize 残件数以内の取得件数
     * @return 終端ではnull、それ以外は標準取得結果
     */
    public Database.CursorFetchResult fetchMemberPage(
        Database.PaginationCursor cursor,
        Integer startIndex,
        Integer fetchSize
    ) {
        // 空集合には取得APIを呼び出さない
        return fetchSize == 0 ? null : cursor.fetchPage(startIndex, fetchSize);
    }

    /**
     * ページ内のユーザーを現在の所属条件と参照権限で再確認
     * @param request 検証済みの親と表示条件
     * @param fields 現在参照できる固定項目
     * @param ids 標準カーソルから取得したID
     * @return 現在も参照可能で条件に一致するユーザー
     */
    public List<User> selectMemberRecords(OrgExplorerPageRequest request, List<String> fields, Set<Id> ids) {
        // 空ページから全ユーザーを照会しない
        if (ids.isEmpty()) {
            return new List<User>();
        }
        // 別の所属や無効条件のカーソルを流用してもレコードを公開しない
        String query =
            'SELECT ' +
            String.join(fields, ',') +
            ' FROM User WHERE ' +
            memberPredicate(request) +
            ' AND Id IN :ids LIMIT 50';
        // ページ取得時点の共有と項目権限を適用
        return Database.queryWithBinds(
            query,
            new Map<String, Object>{ 'parentId' => request.parentId, 'ids' => ids },
            AccessLevel.USER_MODE
        );
    }

    // カーソル作成と再確認に同じ表示条件を適用
    private String memberPredicate(OrgExplorerPageRequest request) {
        // 外部入力を項目名として連結しない
        String relationField = request.mode == 'MANAGER' ? 'ManagerId' : 'UserRoleId';
        // 選択対象だけを照会し、有効条件も同じ式へまとめる
        return relationField + ' = :parentId' + (request.includeInactive == true ? '' : ' AND IsActive = true');
    }

    /**
     * 所属一覧で必要なプロファイルの可視性を一括確認
     * @param ids 一ページに含まれる関連先
     * @return 参照できるIDと名称だけ
     */
    public List<Profile> selectProfiles(Set<Id> ids) {
        // 対象なしで全プロファイルを取得しない
        if (ids.isEmpty()) {
            return new List<Profile>();
        }
        // 関連先にもユーザーモードを適用
        return [SELECT Id, Name FROM Profile WHERE Id IN :ids WITH USER_MODE LIMIT 51];
    }
    /**
     * 指定した親ユーザーの可視性を確認、未指定では照会しない
     * @param parentId 起点ユーザー、未指定を許容
     * @return 参照可能な親ユーザー、未指定・非存在・非可視では空リスト
     */
    public List<User> selectManagerParentUser(Id parentId) {
        // 起点未指定を全ユーザー照会へ変換しない
        if (parentId == null) {
            return new List<User>();
        }
        // 可視性の確認に必要なIDだけを利用者権限で取得
        List<User> records = [SELECT Id FROM User WHERE Id = :parentId WITH USER_MODE LIMIT 1];
        // 検索結果を加工せず呼び出し元へ返却
        return records;
    }

    /**
     * 上司ID順に直属部下の人数を集計
     * @param request 検証済みの表示条件
     * @param afterId 前の集計境界、初回はnull
     * @return 最大1001上司の集計
     */
    public List<AggregateResult> selectManagerGroups(OrgExplorerPageRequest request, Id afterId) {
        // 一般メンバーのレコードを転送せず上司単位へ集約
        String query = 'SELECT ManagerId managerId, COUNT(Id) memberCount FROM User WHERE ManagerId != null';
        // 非表示の上司を集計前に除外し、取得枠を消費させない
        if (request.includeInactive != true) {
            query += ' AND IsActive = true AND Manager.IsActive = true';
        }
        // ID順で集計結果を継続しOFFSETを使用しない
        if (afterId != null) {
            query += ' AND ManagerId > :afterId';
        }
        // 集計グループ数を一回の取得範囲に限定
        query += ' GROUP BY ManagerId ORDER BY ManagerId LIMIT 1001';
        // 共有と項目権限を集計にも適用
        return Database.queryWithBinds(query, new Map<String, Object>{ 'afterId' => afterId }, AccessLevel.USER_MODE);
    }

    /**
     * 上司候補の氏名を前方一致で検索
     * @param request 名前と有効条件を検証済みの候補要求
     * @return 最大51上司の集計
     */
    public List<AggregateResult> searchManagerGroups(OrgExplorerSearchRequest request) {
        // LIKEの制御文字を通常文字として検索
        String pattern = request.term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%';
        // 利用者が参照できる部下を持つ上司だけを候補にする
        String query = 'SELECT ManagerId managerId, COUNT(Id) memberCount FROM User WHERE ManagerId != null AND Manager.Name LIKE :pattern';
        // 非表示の無効ユーザーを候補と人数へ混ぜない
        if (request.activityFilter == 'ACTIVE') {
            query += ' AND IsActive = true AND Manager.IsActive = true';
        }
        // 集計前の任意ユーザー上限で候補を欠落させない
        query += ' GROUP BY ManagerId ORDER BY ManagerId LIMIT 51';
        // 候補IDは公開前に別途Userの可視性を確認
        return Database.queryWithBinds(query, new Map<String, Object>{ 'pattern' => pattern }, AccessLevel.USER_MODE);
    }
    /**
     * 集計候補の共有と有効条件をID順で再確認
     * @param ids 最大1000個の上司または親ID
     * @param fields 参照許可済みの固定User項目
     * @param activityFilter ALLまたはACTIVE
     * @return 現在参照できるユーザー
     */
    public List<User> selectManagers(Set<Id> ids, List<String> fields, String activityFilter) {
        // 空条件を全ユーザーの照会へ変換しない
        if (ids == null || ids.isEmpty()) {
            return new List<User>();
        }
        // 上司の可視性を集計元の部下から推定しない
        String query = 'SELECT ' + String.join(fields, ',') + ' FROM User WHERE Id IN :ids';
        // 無効の親を非表示にする場合も接続し直さない
        if (activityFilter == 'ACTIVE') {
            query += ' AND IsActive = true';
        }
        // 可視ID順の継続境界を照会側で確定
        query += ' ORDER BY Id LIMIT 1000';
        // 生のUserを外部へ返さずServiceでDTOへ変換
        return Database.queryWithBinds(query, new Map<String, Object>{ 'ids' => ids }, AccessLevel.USER_MODE);
    }
}