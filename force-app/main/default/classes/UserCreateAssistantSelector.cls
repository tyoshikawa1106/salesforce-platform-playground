/** ユーザー作成画面と保存処理の参照元を利用者権限で取得 */
public with sharing class UserCreateAssistantSelector {
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
        String query = 'SELECT ' + String.join(queryFields, ',') + ' FROM User WHERE Id = :sourceId AND ContactId = null LIMIT 1';
        // 利用者の参照可能範囲に絞って取得
        return Database.queryWithBinds(query, new Map<String, Object>{ 'sourceId' => sourceId }, AccessLevel.USER_MODE);
    }

    /**
     * 保存時点でコピー元の固定項目を再取得
     * @param sourceId 保存要求のコピー元
     * @return 同一トランザクションで使う元ユーザー
     */
    public List<User> getSourceForSave(Id sourceId) {
        // 対象未指定では全件検索しない
        if (sourceId == null) {
            return new List<User>();
        }
        // 固定値は画面から受け取らずコピー元の最新設定を使用
        return [SELECT Id, ProfileId, UserRoleId, ContactId FROM User WHERE Id = :sourceId WITH USER_MODE LIMIT 1];
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
