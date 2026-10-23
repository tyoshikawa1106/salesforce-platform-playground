/**
 * 読み取り専用の組織エクスプローラー公開API
 */
public with sharing class OrgExplorerController {

    private static OrgExplorerService service = new OrgExplorerService();
    // 階層構造と独立した共通メンバー一覧の処理
    private static OrgExplorerMemberService memberService = new OrgExplorerMemberService();
    private static OrgExplorerRequestService requestService = new OrgExplorerRequestService();
    private static OrgExplorerSelector selector = new OrgExplorerSelector();
    private static OrgExplorerCursorCodec codec = new OrgExplorerCursorCodec();

    /**
     * 現在の権限で利用可能な階層モードを確認
     * @param request 相関キーの文字列、未指定や不正な形式は拒否
     * @return 利用可能なモードと所属一覧の参照可否
     */
    @AuraEnabled
    public static OrgExplorerCapabilitiesResponse getCapabilities(String request) {
        // 応答を要求ごとに初期化
        OrgExplorerCapabilitiesResponse response = new OrgExplorerCapabilitiesResponse();
        // 想定外の例外を外部へ公開しない
        try {
            // 形式を検証してからデータを照会
            String code = requestService.validateEnvelope(request, request);
            // 不正要求では起点を取得しない
            if (String.isNotEmpty(code)) {
                response.ok = false;
                response.error = service.createError(code);
                return response;
            }
            // Describeは各要求で再評価
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            // カードの項目ラベルを既存応答へまとめる
            response.cardFieldLabels = access.getCardFieldLabels();
            // 上司階層の可否を通知
            response.managerModeEnabled = access.managerEnabled;
            // ロール構造の可否を独立して通知
            response.roleModeEnabled = access.rolesEnabled;
            // ロールのUser一覧には両方の権限が必要
            response.roleMembersEnabled = access.membershipEnabled && access.rolesEnabled;
        } catch (Exception e) {
            // 生の例外・個人情報・SOQLを公開しない
            response.ok = false;
            response.error = service.createError('SERVER_ERROR');
        }
        // 機能情報を返却
        return response;
    }

    /**
     * ロール・上司の構造または直属ユーザーの一ページを取得
     * @param request モードに対応する固定scope、親、有効条件、継続位置
     * @return 現在の権限で参照できる構造またはユーザー一覧
     */
    @AuraEnabled
    public static OrgExplorerPageResponse getPage(OrgExplorerPageRequest request) {
        // 入力と参照権限を確認してから取得先を決める
        try {
            // 権限はモード切り替えやページ移動のたびに再評価
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            // モードとscope、親の型を同じ契約で検証
            String code = requestService.validatePage(request, access);
            // 不正要求で対象や関連先を照会しない
            if (String.isNotEmpty(code)) {
                return failure(code);
            }
            // IDだけを知っている対象から配下を列挙させない
            if (!isParentVisible(request)) {
                return failure('NOT_FOUND_OR_UNAVAILABLE');
            }
            // 両モードのユーザー一覧は同じ標準ページングを利用
            if (request.scope == 'ROLE_MEMBERS' || request.scope == 'MANAGER_MEMBERS') {
                return loadUserPage(request, access);
            }
            // 構造取得だけ独自の継続境界を使用
            return loadStructurePage(request, access);
        } catch (System.FatalCursorException e) {
            // 失効した標準カーソルの内部情報を公開しない
            return failure('INVALID_CURSOR');
        } catch (QueryException e) {
            // ユーザーモードによる参照拒否を安全な失敗へ変換
            return failure('ACCESS_DENIED');
        } catch (Exception e) {
            // 生の例外や検索条件を公開しない
            return failure('SERVER_ERROR');
        }
    }

    // 構造の継続境界を検証してからモードに対応する照会へ進む
    private static OrgExplorerPageResponse loadStructurePage(
        OrgExplorerPageRequest request,
        OrgExplorerAccessPolicy access
    ) {
        // ユーザー一覧の標準カーソルを構造取得へ流用させない
        if (request.paginationCursor != null || (request.startIndex != null && request.startIndex != 0)) {
            return failure('INVALID_CURSOR');
        }
        // 閲覧者と現在の表示条件へ継続境界を固定
        OrgExplorerCursorCodec.Cursor expected = service.createPageCursor(request);
        // 不正な継続値を初回として扱わない
        OrgExplorerCursorCodec.Cursor cursor = String.isBlank(request.cursor)
            ? null
            : codec.decodeMatching(request.cursor, expected);
        // モードに対応したIDの型まで確認
        Schema.SObjectType recordType = request.mode == 'MANAGER' ? User.SObjectType : UserRole.SObjectType;
        // 不正な境界から後続の構造を照会しない
        if (!codec.isPagePositionValid(request.cursor, cursor, recordType)) {
            return failure('INVALID_CURSOR');
        }
        // モード固有の照会順だけを分け、継続検証は共用
        return request.mode == 'MANAGER'
            ? loadManagerPage(request, cursor, access)
            : loadRolePage(request, cursor?.lastId, access);
    }

    /**
     * 起点ロール候補を階層・名称・初期API名から取得
     * @param request 未入力候補の親集合、前方一致語、または初期API名
     * @return 参照可能な候補と絞り込み要否
     */
    @AuraEnabled
    public static OrgExplorerPageResponse searchRoles(OrgExplorerSearchRequest request) {
        // 要求ごとに候補応答を初期化
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // 検索語や内部例外を公開しない境界
        try {
            // ロール参照可否を現在の利用者で評価
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            // 名前とAPI名の検索を排他的に検証
            String code = requestService.validateSearch(request, access);
            // 不正入力では検索しない
            if (String.isNotEmpty(code)) {
                response.ok = false;
                response.error = service.createError(code);
                return response;
            }
            // 正規化後の条件だけをSelectorへ渡す
            String term = requestService.normalizeSearchTerm(request.term);
            // 初期API名も前後空白を除去
            String developerName = requestService.normalizeSearchTerm(request.developerName);
            // 未入力は最上位、入力時は名称またはAPI名で可視候補を取得
            List<UserRole> records = selector.searchRoles(term, developerName);
            // 未公開の親IDを含まない候補へ変換
            response = service.createRoleSearchResults(records);
        } catch (QueryException e) {
            // USER_MODEによる拒否を通知
            response.ok = false;
            response.error = service.createError('ACCESS_DENIED');
        } catch (Exception e) {
            // 検索語や生の例外を公開しない
            response.ok = false;
            response.error = service.createError('SERVER_ERROR');
        }
        // 候補上限の有無と可視候補を返却
        return response;
    }

    // 可視確認済みのロールページに直接所属人数を付加
    private static OrgExplorerPageResponse loadRolePage(
        OrgExplorerPageRequest request,
        Id lastId,
        OrgExplorerAccessPolicy access
    ) {
        // 先読み行を除いた公開ページへ変換
        OrgExplorerPageResponse response = loadRoleStructurePage(request, lastId);
        // 所属情報を参照できない場合は空集合とし照会を省略
        Set<Id> roleIds = service.getMemberCountRoleIds(response, access);
        // ロールごとの照会を避けて一括集計
        List<AggregateResult> counts = selector.countRoleMembers(roleIds, request);
        // 個別ユーザーを応答へ含めず人数だけを反映
        response.roleMemberCounts = service.createRoleMemberCounts(roleIds, counts);
        // 所属情報を読めない場合もロール構造は返す
        return response;
    }

    // 階層に依存せず構造を取得し、ページ外の親の可視性も確認
    private static OrgExplorerPageResponse loadRoleStructurePage(OrgExplorerPageRequest request, Id lastId) {
        // 一度に全組織をヒープへ積まず固定件数で取得
        List<UserRole> records = selector.selectRoleStructurePage(lastId);
        // 取得済みのページに含まれない親だけを確認対象にする
        Set<Id> parentIds = service.getUnloadedRoleParentIds(records);
        // ページ境界をまたぐ親も一括で可視確認
        List<UserRole> parents = selector.selectRoles(parentIds, new List<String>{ 'Id' });
        // 未確認の関係先を応答へ含めない
        OrgExplorerPageResponse response = service.createRolePage(records, parents, request);
        // 可視確認を反映した構造ページを返却
        return response;
    }

    // ロール構造と所属一覧の親を同じ可視性で確認
    private static Boolean isParentVisible(OrgExplorerPageRequest request) {
        // 全ロール取得では親の指定を要求しない
        if (request.parentId == null) {
            return true;
        }
        // 上司本人の可視性も部下の参照可否から推定しない
        if (request.mode == 'MANAGER') {
            // 取得したListをServiceで確認し、Controllerでレコードを加工しない
            List<User> parents = selector.selectManagerParentUser(request.parentId);
            // 非存在と非可視を同じ判定にする
            Boolean visible = service.canReadManagerParent(request, parents);
            // 可視判定の結果だけを呼び出し元へ返却
            return visible;
        }
        // IDを知っているだけでは関連する一覧を公開しない
        List<UserRole> roles = selector.selectRoles(new Set<Id>{ request.parentId }, new List<String>{ 'Id' });
        // 参照できた親がある場合だけ後続の照会へ進む
        return !roles.isEmpty();
    }

    /**
     * 現在の権限でユーザー一覧と関連先を一括取得
     * @param request 親の可視性を確認済みの一覧条件
     * @param access 要求時点の項目権限
     * @return 固定範囲のページと参照可能な列
     */
    private static OrgExplorerPageResponse loadUserPage(
        OrgExplorerPageRequest request,
        OrgExplorerAccessPolicy access
    ) {
        // 不正な標準位置をデータ照会前に拒否
        String code = requestService.validateMemberPosition(request);
        // 旧形式の継続値もユーザー一覧へ混入させない
        if (String.isNotEmpty(code)) {
            // 既存の共通応答で不正位置を通知
            return failure(code);
        }
        // 前後ページでは受け取った標準カーソルを再利用
        Database.PaginationCursor paginationCursor = request.paginationCursor;
        // 初回だけ結果集合を作成
        if (paginationCursor == null) {
            // 既存カーソルがある場合は再照会しない
            paginationCursor = selector.createMemberCursor(request);
        }
        // 残件数に合わせて今回取得するページ件数を確定
        Integer fetchSize = requestService.getMemberFetchSize(paginationCursor, request.startIndex, request.pageSize);
        // 残件数以内のページを標準APIから取得
        Database.CursorFetchResult fetched = selector.fetchMemberPage(paginationCursor, request.startIndex, fetchSize);
        // 現在の条件と権限でページ内のIDだけを再確認
        Set<Id> ids = memberService.getMemberIds(fetched);
        // 任意項目もページ取得時点の参照権限で取得
        List<String> fields = access.getUserFields(request.scope);
        // ページ内のユーザーを現在の条件で再照会
        List<User> visibleRecords = selector.selectMemberRecords(request, fields, ids);
        // 再照会の結果を標準カーソルの順序に揃える
        List<User> records = memberService.orderMemberRecords(fetched, visibleRecords);
        // 所属や共有が変わったページを部分的な成功として公開しない
        if (records.size() != ids.size()) {
            // 同じ安全なエラー契約で再取得を案内
            return failure('INVALID_CURSOR');
        }
        // 参照可能なマネージャーIDを重複排除
        Set<Id> managerIds = memberService.getManagerIds(records, access);
        // 関連先の共有と項目権限を一括で再確認
        List<User> managers = selector.selectUsers(managerIds, new List<String>{ 'Id', 'Name' });
        // 参照可能なプロファイルIDを重複排除
        Set<Id> profileIds = memberService.getProfileIds(records, access);
        // プロファイルをユーザーごとに照会しない
        List<Profile> profiles = selector.selectProfiles(profileIds);
        // 取得結果と標準カーソルを同じ応答生成へ渡す
        OrgExplorerMemberService.MemberPageData wrapper = new OrgExplorerMemberService.MemberPageData(
            records,
            managers,
            profiles
        );
        // 上司メンバーのロールを一ページ分まとめて可視確認
        Set<Id> roleIds = memberService.getRoleIds(records, access, request.scope);
        List<UserRole> roles = selector.selectRoles(roleIds, new List<String>{ 'Id', 'Name' });
        wrapper.roles = new Map<Id, UserRole>(roles);
        // カーソルはレコードの参照権限を与えない
        wrapper.paginationCursor = paginationCursor;
        // 次の位置は標準取得結果から確定
        wrapper.fetched = fetched;
        // 項目権限と関連先の可視性を適用したページを返却
        OrgExplorerPageResponse response = memberService.createMemberPage(wrapper, request, access);
        // 参照可能な列とユーザーを含むページを返却
        return response;
    }
    /**
     * 上司候補を氏名前方一致で検索
     * @param request 氏名と有効条件
     * @return 最大50人の可視候補
     */
    @AuraEnabled
    public static OrgExplorerPageResponse searchManagers(OrgExplorerSearchRequest request) {
        try {
            // 現在の参照権限と入力契約をServiceで確認
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            // 上司候補の要求に対応した検証結果を取得
            String code = requestService.validateManagerSearch(request, access);
            // 入力不正や権限不足で候補を照会しない
            if (String.isNotEmpty(code)) {
                return failure(code);
            }
            // 検索語の意味を確定してからSelectorへ渡す
            request.term = requestService.normalizeSearchTerm(request.term);
            // 部下を持つ上司の候補を一括取得
            List<AggregateResult> groups = selector.searchManagerGroups(request);
            // 先読み行を除いて候補本人のIDを取得
            Set<Id> managerIds = service.getManagerGroupIds(groups, 50);
            // 候補に表示できる項目を確定
            List<String> fields = access.getUserFields('MANAGER_SEARCH');
            // 候補本人の可視性を集計元から推定しない
            List<User> records = selector.selectManagers(managerIds, fields, request.activityFilter);
            // 取得結果を応答生成へまとめて渡す
            OrgExplorerService.ManagerPageData wrapper = new OrgExplorerService.ManagerPageData(groups, records);
            // 可視候補だけを公開応答へ変換
            OrgExplorerPageResponse response = service.createManagerSearchResults(wrapper, access);
            // 参照可能な候補だけを返却
            return response;
        } catch (QueryException e) {
            // 照会拒否でユーザーの存在を公開しない
            return failure('ACCESS_DENIED');
        } catch (Exception e) {
            // 生の検索条件や例外を公開しない
            return failure('SERVER_ERROR');
        }
    }

    // 上司の構造と表示に必要な関連先をページ単位で一括照会
    private static OrgExplorerPageResponse loadManagerPage(
        OrgExplorerPageRequest request,
        OrgExplorerCursorCodec.Cursor cursor,
        OrgExplorerAccessPolicy access
    ) {
        // 一般メンバーを取得せず上司ごとの人数を集計
        List<AggregateResult> groups = selector.selectManagerGroups(request, cursor?.lastId);
        // 先読み行を除いて構造ページの上司IDを取得
        Set<Id> managerIds = service.getManagerGroupIds(groups, 1000);
        // 構造カードに表示できる項目を確定
        List<String> fields = access.getUserFields(request.scope);
        // 本人と親の照会で同じ有効条件を使用
        String activityFilter = request.includeInactive == true ? 'ALL' : 'ACTIVE';
        // 集計した上司本人の共有と表示条件を再確認
        List<User> records = selector.selectManagers(managerIds, fields, activityFilter);
        // ページと関連先を同じ応答生成へまとめる
        OrgExplorerService.ManagerPageData wrapper = new OrgExplorerService.ManagerPageData(groups, records);
        // 上司自身のマネージャーIDを重複排除
        Set<Id> parentIds = memberService.getManagerIds(records, access);
        // 親の可視性を本人の可視性から推定しない
        wrapper.parents = selector.selectManagers(parentIds, new List<String>{ 'Id' }, activityFilter);
        // 参照可能な所属ロールIDを取得
        Set<Id> roleIds = memberService.getRoleIds(records, access, request.scope);
        // 許可された所属ロールだけを重複排除して照会
        wrapper.roles = selector.selectRoles(roleIds, new List<String>{ 'Id', 'Name' });
        // 取得結果からノードと項目の参照状態を構築
        OrgExplorerPageResponse response = service.createManagerStructure(wrapper, request, access);
        // 可視確認を反映した上司構造を返却
        return response;
    }

    // 内部の例外や存在確認結果を公開しない安全な応答
    private static OrgExplorerPageResponse failure(String code) {
        // 公開応答を要求ごとに初期化
        OrgExplorerPageResponse response = new OrgExplorerPageResponse();
        // 成功応答と失敗を区別
        response.ok = false;
        // 固定のエラー契約で内部情報を隠す
        response.error = service.createError(code);
        // 公開可能な応答だけを呼び出し元へ返却
        return response;
    }
}