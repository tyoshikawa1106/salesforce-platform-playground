/** ログインユーザーの言語・地域設定の取得と保存の入口 */
public with sharing class UserLocaleSettingsController {

    private static UserLocaleSettingsService service = new UserLocaleSettingsService();
    private static UserLocaleSettingsSelector selector = new UserLocaleSettingsSelector();

    /**
     * 本人の最新設定と利用可能な候補を取得
     * @return 言語・地域の現在値と候補、編集可否
     */
    @AuraEnabled
    public static UserLocaleSettingsWrapper getSettings() {
        // 内部例外を画面へ公開しない
        try {
            // ログインユーザーの設定だけを照会
            List<User> records = selector.getCurrentUser();
            // 取得結果と選択肢を表示用に変換
            UserLocaleSettingsWrapper wrapper = service.createSettings(records);
            // 画面の初期状態を返却
            return wrapper;
        } catch (Exception e) {
            // 個人情報を含まない再試行案内へ変換
            throw new AuraHandledException('言語・地域を取得できませんでした。再読み込みしてください。');
        }
    }

    /**
     * 本人の言語・地域だけを利用者権限で一括保存
     * @param language 保存する言語コード
     * @param locale 保存する地域コード
     * @return 保存値または入力・権限エラー、成功後は画面の再読み込みが必要
     */
    @AuraEnabled
    public static UserLocaleSettingsWrapper saveSettings(String language, String locale) {
        // 更新失敗を安全な画面メッセージへ変換
        try {
            // 最新の権限と候補で入力を検証
            UserLocaleSettingsWrapper wrapper = service.prepareSave(language, locale);
            // 想定内の拒否では更新しない
            if (String.isNotEmpty(wrapper.errorMessage)) {
                // 再試行可能な入力エラーを返却
                return wrapper;
            }
            // 言語と地域を単一レコードで原子的に更新
            Database.update(wrapper.record, AccessLevel.USER_MODE);
            // 保存済みの値を返却
            return wrapper;
        } catch (Exception e) {
            // 内部の例外本文を公開しない
            throw new AuraHandledException('保存できませんでした。権限を確認して再実行してください。');
        }
    }
}