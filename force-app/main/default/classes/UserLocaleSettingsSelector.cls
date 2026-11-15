/** ログインユーザーの言語・地域設定の取得 */
public with sharing class UserLocaleSettingsSelector {

    /**
     * 利用者権限で本人の設定だけを取得
     * @return 本人の設定、参照できる対象がなければ空リスト
     */
    public List<User> getCurrentUser() {
        // 検索対象をログインユーザーに固定
        Id currentUserId = UserInfo.getUserId();
        // 必要な設定項目だけを取得
        List<User> records = [
            SELECT Id, LanguageLocaleKey, LocaleSidKey
            FROM User
            WHERE Id = :currentUserId
            WITH USER_MODE
            LIMIT 1
        ];
        // 取得結果を加工せず返却
        return records;
    }
}
