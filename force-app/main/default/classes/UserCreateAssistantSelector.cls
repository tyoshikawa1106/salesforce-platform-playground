/** ユーザー作成画面と保存処理の参照元を利用者権限で取得 */
public with sharing class UserCreateAssistantSelector {
    // 表示・保存の同じトランザクション内ではプロファイルを再照会しない
    private Set<Id> sourceProfileIds;

    /** 現在ユーザーの設定参照・ユーザー管理の実効権限を取得
     * @return 現在のセッションに適用される権限
     */
    public List<UserPermissionAccess> getPermissions() {
        try {
            return [SELECT PermissionsViewSetup, PermissionsManageUsers FROM UserPermissionAccess WITH USER_MODE LIMIT 1];
        } catch (QueryException e) {
            // 照会できない場合も、取得結果がない場合と同じ権限取得エラーを表示する
            return new List<UserPermissionAccess>();
        }
    }

    /**
     * 社内ユーザーの検索・保存に使うプロファイルを取得
     * @return 標準ユーザーと社内 Chatter Free のプロファイル ID
     */
    public Set<Id> getSourceProfileIds() {
        // CsnOnly には社外向けの Chatter External も含まれるためライセンスを照合
        if (sourceProfileIds == null) {
            sourceProfileIds = new Map<Id, Profile>([
                SELECT Id FROM Profile
                WHERE UserType = 'Standard' OR (UserType = 'CsnOnly' AND UserLicense.LicenseDefinitionKey = 'CSN_User')
                WITH USER_MODE
            ]).keySet();
        }
        return sourceProfileIds;
    }

    /**
     * 画面に表示するユーザーを取得
     * @param sourceId 選択したコピー元
     * @param queryFields Service が Describe で確認した表示項目・参照先項目
     * @return 選択したユーザーの参照可能な項目
     */
    public List<User> getUsers(Id sourceId, List<String> queryFields) {
        // 検索対象が定まらない場合は照会を行わない
        if (sourceId == null || queryFields == null || queryFields.isEmpty()) {
            return new List<User>();
        }
        // 項目はサーバーで決定し、レコードIDをバインド
        String query = 'SELECT ' + String.join(queryFields, ',') + ' FROM User WHERE Id = :sourceId AND ContactId = null AND ProfileId IN :profiles LIMIT 1';
        // 利用者の参照可能範囲に絞って取得
        return Database.queryWithBinds(query, new Map<String, Object>{ 'sourceId' => sourceId, 'profiles' => getSourceProfileIds() }, AccessLevel.USER_MODE);
    }

    /**
     * 保存時点でコピー元の固定項目を再取得
     * @param sourceId 保存要求のコピー元
     * @return 同一トランザクションで使う元ユーザー
     */
    public List<User> getSourceForSave(Id sourceId) {
        // 表示時と同じ社内ユーザー条件で最新の固定値を取得
        return getUsers(sourceId, new List<String>{ 'Id', 'ProfileId', 'UserRoleId', 'ContactId' });
    }

    /**
     * 現在有効な権限セット・グループの直接割り当てを取得
     * @param userId 対象ユーザー
     * @return プロファイルに由来する権限を除いた割り当て
     */
    public List<PermissionSetAssignment> getAssignments(Id userId) {
        // 対象が未指定なら照会しない
        if (userId == null) {
            return new List<PermissionSetAssignment>();
        }
        // 失効済みの権限とプロファイル割り当ては引き継がない
        return [
            SELECT PermissionSetId, PermissionSetGroupId, ExpirationDate
            FROM PermissionSetAssignment
            WHERE AssigneeId = :userId AND IsActive = TRUE AND IsRevoked = FALSE
                AND (PermissionSetGroupId != NULL OR PermissionSet.IsOwnedByProfile = FALSE)
            WITH USER_MODE
        ];
    }
}