/**
 * 組織探索の一覧要求・継続位置・候補検索の検証
 */
public with sharing class OrgExplorerRequestService {

    /**
     * 共通入力のサイズと相関キーを確認
     * @param request 型付きの公開要求
     * @param requestId 呼び出し元の相関キー
     * @return 正常時は空文字、不正時は公開エラーコード
     */
    public String validateEnvelope(Object request, String requestId) {
        // 過大な要求と不正な相関キーを拒否
        if (
            request == null ||
            !Pattern.matches('[A-Za-z0-9-]{1,64}', requestId ?? '') ||
            JSON.serialize(request).length() > 16384
        ) {
            return 'INVALID_REQUEST';
        }
        // 検証成功を空文字で表現
        return '';
    }

    /**
     * ロール候補の検索条件と参照権限を確認
     * @param request 名称または初期API名の要求
     * @param access 現在の参照可否
     * @return 正常時は空文字、不正時は公開エラーコード
     */
    public String validateSearch(OrgExplorerSearchRequest request, OrgExplorerAccessPolicy access) {
        // 項目権限を読む前に要求形式を確認
        String code = validateEnvelope(request, request?.requestId);
        // 共通の不正を先に通知
        if (String.isNotEmpty(code)) {
            return code;
        }
        // ロール検索を許可できない場合は停止
        if (!access.rolesEnabled) {
            return 'ACCESS_DENIED';
        }
        // 初期API名と名称の両方を同時に指定させない
        String developerName = normalizeSearchTerm(request.developerName);
        // 前後空白だけを除いた検索語
        String term = normalizeSearchTerm(request.term);
        // API名の完全一致は初期選択に限定
        if (String.isNotEmpty(developerName)) {
            // 識別子以外を受け付けず、広い検索へ切り替えない
            return String.isEmpty(term) &&
                Pattern.matches('[A-Za-z][A-Za-z0-9_]{0,79}', developerName)
                ? ''
                : 'INVALID_REQUEST';
        }
        // 空入力は階層候補、入力時は前方一致として扱う
        if (term.length() > 80) {
            return 'INVALID_REQUEST';
        }
        // 検索条件が確定したことを返却
        return '';
    }

    /**
     * ロール検索語の前後空白を除去
     * @param term 入力された検索語、nullを許容
     * @return 未入力では空文字、入力時は前後空白のない検索語
     */
    public String normalizeSearchTerm(String term) {
        // 検索の意味を変えず、未入力を空文字へ統一
        return String.isBlank(term) ? '' : term.trim();
    }
    /**
     * 標準カーソルの取得位置と旧形式の混在を検証
     * @param request 現在のユーザー一覧要求
     * @return 正常時は空文字、不正時は公開コード
     */
    public String validateMemberPosition(OrgExplorerPageRequest request) {
        // 任意の取得件数で応答上限を拡大させない
        if (!isMemberPageSizeValid(request.pageSize)) {
            return 'INVALID_REQUEST';
        }
        // 独自の境界値をユーザー一覧へ再利用しない
        if (String.isNotBlank(request.cursor) || !isMemberStartIndexValid(request.startIndex)) {
            return 'INVALID_CURSOR';
        }
        // カーソルなしで途中から取得しない
        if (request.paginationCursor == null) {
            return request.startIndex == 0 ? '' : 'INVALID_CURSOR';
        }
        // 終端より後ろや件数を超える位置を拒否
        Integer total = request.paginationCursor.getNumRecords();
        // 空集合だけは先頭位置を許容
        return request.startIndex > 0 && request.startIndex >= total ? 'INVALID_CURSOR' : '';
    }

    /**
     * 残件数以内のページサイズを算出
     * @param cursor 標準カーソル
     * @param startIndex 検証済みの取得位置
     * @param pageSize 1〜50の検証済み件数、省略時は50
     * @return 空集合では0、それ以外は指定件数以内
     */
    public Integer getMemberFetchSize(Database.PaginationCursor cursor, Integer startIndex, Integer pageSize) {
        // 削除行のスキップと次の位置の計算は標準APIへ委譲
        return Math.min(pageSize ?? 50, Math.max(0, cursor.getNumRecords() - startIndex));
    }
    /**
     * 上司候補の検索語・表示条件・参照前提を検証
     * @param request 氏名前方一致の要求、空欄は不可
     * @param access 現在の参照権限
     * @return 正常時は空文字、それ以外は公開エラーコード
     */
    public String validateManagerSearch(OrgExplorerSearchRequest request, OrgExplorerAccessPolicy access) {
        // 公開要求の共通形式を先に確認
        String code = validateEnvelope(request, request?.requestId);
        // 空の要求を初期検索として扱わない
        if (String.isNotEmpty(code)) {
            return code;
        }
        // 検索語と有効条件を固定した入力契約へ限定
        if (
            String.isBlank(request.term) ||
            request.term.length() > 80 ||
            !new Set<String>{ 'ALL', 'ACTIVE' }.contains(request.activityFilter)
        ) {
            return 'INVALID_REQUEST';
        }
        // 上司項目の参照権限を検索でも必須にする
        return access.managerEnabled ? '' : 'ACCESS_DENIED';
    }

    // 未指定は通常件数とし、明示された値だけを公開上限内へ限定
    private Boolean isMemberPageSizeValid(Integer pageSize) {
        // 境界のない取得や空ページの繰り返しを許可しない
        return pageSize == null || (pageSize >= 1 && pageSize <= 50);
    }

    // 標準カーソルが扱う取得位置の範囲を確認
    private Boolean isMemberStartIndexValid(Integer startIndex) {
        // 未指定・負数・上限超過を取得位置に使用しない
        return startIndex != null && startIndex >= 0 && startIndex < 100000;
    }

    /**
     * 階層一覧のモード・範囲・親・参照権限を確認
     * @param request 一覧要求
     * @param access 現在の参照可否
     * @return 正常時は空文字、不正時は公開エラーコード
     */
    public String validatePage(OrgExplorerPageRequest request, OrgExplorerAccessPolicy access) {
        // 不正要求で関連情報を照会しない
        String code = validateEnvelope(request, request?.requestId);
        // 共通検証の失敗はそのまま返却
        if (String.isNotEmpty(code)) {
            return code;
        }
        // 許可する範囲とモードの対応を一箇所に固定
        Map<String, String> modes = new Map<String, String>{
            'ROLE_STRUCTURE' => 'ROLE',
            'ROLE_MEMBERS' => 'ROLE',
            'MANAGER_STRUCTURE' => 'MANAGER',
            'MANAGER_MEMBERS' => 'MANAGER'
        };
        // 未知の範囲・異なるモード・過大な継続値を拒否
        if (!modes.containsKey(request.scope) || request.mode != modes.get(request.scope) || (request.cursor?.length() ?? 0) > 4096) {
            return 'INVALID_REQUEST';
        }
        // 親の型は検証済みモードの固定対応から決定
        Schema.SObjectType parentType = new Map<String, Schema.SObjectType>{
            'ROLE' => UserRole.SObjectType,
            'MANAGER' => User.SObjectType
        }.get(request.mode);
        // 構造だけ親の未指定を許可し、指定時はオブジェクト型を確認
        if (request.parentId == null ? request.scope.endsWith('_MEMBERS') : request.parentId.getSObjectType() != parentType) {
            return 'INVALID_REQUEST';
        }
        // 範囲ごとの必要権限を固定対応で評価
        Map<String, Boolean> allowed = new Map<String, Boolean>{
            'ROLE_STRUCTURE' => access.rolesEnabled,
            'ROLE_MEMBERS' => access.rolesEnabled && access.membershipEnabled,
            'MANAGER_STRUCTURE' => access.managerEnabled,
            'MANAGER_MEMBERS' => access.managerEnabled
        };
        // 形式不正と権限不足を同じ失敗へ混同させない
        return allowed.get(request.scope) == true ? '' : 'ACCESS_DENIED';
    }
}