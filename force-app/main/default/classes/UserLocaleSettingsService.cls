/** 言語・地域の候補生成と本人設定の更新検証 */
public with sharing class UserLocaleSettingsService {

    /**
     * 現在値と利用可能な選択肢を画面用に生成
     * @param records 本人の設定、nullと空を許容
     * @return 現在値、候補、編集可否または取得失敗の案内
     */
    public UserLocaleSettingsWrapper createSettings(List<User> records) {
        // 現在の項目定義と権限を取得
        UserLocaleSettingsWrapper wrapper = this.createOptions();
        // 本人を取得できなかった場合は編集させない
        if (records == null || records.isEmpty()) {
            // 不完全な状態での保存を禁止
            wrapper.canEdit = false;
            // 取得失敗を画面へ通知
            wrapper.errorMessage = '言語・地域の設定を取得できませんでした。';
            // 不完全な結果として返却
            return wrapper;
        }
        // 空でない取得結果から本人の設定を参照
        User currentUser = records[0];
        // 言語の現在値を保持
        wrapper.language = currentUser.LanguageLocaleKey ?? '';
        // 地域の現在値を保持
        wrapper.locale = currentUser.LocaleSidKey ?? '';
        // 画面表示に必要な値だけを返却
        return wrapper;
    }

    /**
     * 最新の項目定義と権限に基づき保存要求を検証
     * @param language 保存する言語コード
     * @param locale 保存する地域コード
     * @return 本人の更新レコードまたは拒否理由
     */
    public UserLocaleSettingsWrapper prepareSave(String language, String locale) {
        // クライアントから候補や権限を受け取らず再評価
        UserLocaleSettingsWrapper options = this.createOptions();
        // 検証済みの本人更新要求へ変換
        UserLocaleSettingsWrapper wrapper = this.buildUpdate(language, locale, options);
        // 判定結果をControllerへ返却
        return wrapper;
    }

    /**
     * Salesforceが提供する有効な候補と編集可否を取得
     * @return 現在の候補と権限
     */
    private UserLocaleSettingsWrapper createOptions() {
        // 候補と権限をまとめる結果を用意
        UserLocaleSettingsWrapper wrapper = new UserLocaleSettingsWrapper();
        // 言語項目の定義を取得
        Schema.DescribeFieldResult languageField = User.LanguageLocaleKey.getDescribe();
        // 地域項目の定義を取得
        Schema.DescribeFieldResult localeField = User.LocaleSidKey.getDescribe();
        // 現在のユーザーが更新できるか評価
        wrapper.canEdit = User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isUpdateable()
            && languageField.isUpdateable() && localeField.isUpdateable();
        // 有効な言語だけを候補へ追加
        wrapper.languages = this.createChoices(languageField.getPicklistValues());
        // 有効な地域だけを候補へ追加
        wrapper.locales = this.createChoices(localeField.getPicklistValues());
        // サーバーで評価した選択肢を返却
        return wrapper;
    }

    /**
     * 選択リスト定義から有効なコードと表示名を生成
     * @param entries 項目の選択リスト定義
     * @return 有効な選択肢
     */
    private Map<String, String> createChoices(List<Schema.PicklistEntry> entries) {
        // 有効な候補の格納先を作成
        Map<String, String> choices = new Map<String, String>();
        // 定義済みの候補を順に検証
        for (Schema.PicklistEntry entry : entries) {
            // 無効化された候補は選択させない
            if (entry.isActive()) {
                // 利用者の言語に対応した表示名を保持
                choices.put(entry.getValue(), entry.getLabel());
            }
        }
        // 画面と保存検証で共通の候補を返却
        return choices;
    }

    /**
     * 検証済みの候補と権限から本人の更新レコードを生成
     * @param language 保存する言語コード、nullを許容
     * @param locale 保存する地域コード、nullを許容
     * @param options サーバーが取得した候補と権限
     * @return 更新対象または拒否理由
     */
    @TestVisible
    private UserLocaleSettingsWrapper buildUpdate(String language, String locale, UserLocaleSettingsWrapper options) {
        // 入力の候補情報を書き換えず結果を生成
        UserLocaleSettingsWrapper wrapper = new UserLocaleSettingsWrapper();
        // 更新権限がない要求を拒否
        if (!options.canEdit) {
            // 権限不足を利用者へ通知
            wrapper.errorMessage = '言語・地域を変更する権限がありません。';
            // 更新対象を生成せず返却
            return wrapper;
        }
        // 未入力または候補外の言語を拒否
        if (String.isBlank(language) || !options.languages.containsKey(language)) {
            // 言語の再選択を案内
            wrapper.errorMessage = '利用可能な言語を選択してください。';
            // 更新対象を生成せず返却
            return wrapper;
        }
        // 未入力または候補外の地域を拒否
        if (String.isBlank(locale) || !options.locales.containsKey(locale)) {
            // 地域の再選択を案内
            wrapper.errorMessage = '利用可能な地域を選択してください。';
            // 更新対象を生成せず返却
            return wrapper;
        }
        // 言語の保存結果を用意
        wrapper.language = language;
        // 地域の保存結果を用意
        wrapper.locale = locale;
        // 本人の許可された2項目だけを更新対象にする
        wrapper.record = new User(Id = UserInfo.getUserId(), LanguageLocaleKey = language, LocaleSidKey = locale);
        // 検証済みの更新対象を返却
        return wrapper;
    }
}
