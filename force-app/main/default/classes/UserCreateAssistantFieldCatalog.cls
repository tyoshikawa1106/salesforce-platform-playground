/** User の標準・カスタム項目の分類と入力型の決定 */
public with sharing class UserCreateAssistantFieldCatalog {
    // ユーザー編集ページに対応する項目をセクション順に列挙
    private static final List<String> STANDARD_GROUPS = new List<String>{
        'ユーザー情報|LastName FirstName MiddleName Suffix Alias Email Username CommunityNickname Title CompanyName Department Division UserRoleId UserLicenseId ProfileId IsActive ContactId EmployeeNumber',
        'ユーザー権限|UserPermissionsMarketingUser UserPermissionsOfflineUser UserPermissionsKnowledgeUser UserPermissionsInteractionUser UserPermissionsSupportUser UserPermissionsSFContentUser UserPermissionsSiteforceContributorUser UserPermissionsSiteforcePublisherUser ForecastEnabled',
        '連絡先情報|Phone Extension Fax MobilePhone Street City StateCode State PostalCode CountryCode Country',
        'シングルサインオン情報|FederationIdentifier',
        '承認者設定|DelegatedApproverId ManagerId',
        '地域の設定|TimeZoneSidKey LocaleSidKey LanguageLocaleKey EmailEncodingKey DefaultCurrencyIsoCode',
        '追加情報|CallCenterId IndividualId'
    };
    // 固定項目はサーバーが選択元の保存済み値から解決
    private static final Set<String> LOCKED = new Set<String>{'ProfileId', 'UserRoleId', 'UserLicenseId'};
    // 組織の既定値があっても画面で明示的に指定する基本項目
    private static final Set<String> REQUIRED = new Set<String>{
        'LastName','Alias','Email','Username','TimeZoneSidKey','LocaleSidKey','LanguageLocaleKey','EmailEncodingKey','IsActive'
    };
    // 管理画面以外の標準属性、認証やログインに関わる派生属性を除外
    private static final Pattern EXCLUDED_STANDARD = Pattern.compile(
        '(?i)^userpreferences|^emailpreferences|password|token|digest|auth|secret|portal|verified|^(id|name|address|userrecordaccessid|senderemail)$'
    );
    // 基本入力と Salesforce の型の対応
    private static final Map<String,String> INPUT_TYPES = new Map<String,String>{
        'STRING'=>'text','TEXTAREA'=>'textarea','EMAIL'=>'email','URL'=>'url','PHONE'=>'tel',
        'INTEGER'=>'number','LONG'=>'number','DOUBLE'=>'number','CURRENCY'=>'number','PERCENT'=>'number',
        'DATE'=>'date','DATETIME'=>'datetime','TIME'=>'time','BOOLEAN'=>'checkbox','PICKLIST'=>'picklist',
        'MULTIPICKLIST'=>'multipicklist','REFERENCE'=>'reference','COMBOBOX'=>'text'
    };
    // 同じ要求の項目検証と表示で利用する User の Describe
    private static final Map<String, Schema.SObjectField> USER_FIELDS = User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap();

    // 標準画面の順序と照会での優先順を明示した項目名一覧
    public List<String> orderedNames { get; private set; }

    /**
     * 実行者が参照できる画面項目を標準の区分に対応付ける
     * @return API 名からセクション表示名への対応
     */
    public Map<String,String> getFieldGroups() {
        // 繰り返し取得しても以前の項目名を残さない
        orderedNames = new List<String>();
        // 宣言順の標準項目を先に登録
        Map<String,String> groups = new Map<String,String>();
        // セクション名と項目列を取り出す
        for (String definition : STANDARD_GROUPS) {
            List<String> parts = definition.split('\\|');
            // 編集ページのセクションに対応する項目を追加
            addStandardFields(groups, parts);
        }
        // 追加の項目も Map の走査順に依存させない
        List<String> additionalNames = new List<String>(USER_FIELDS.keySet());
        // 未定義の標準項目は安定した順序でセクション末尾に置く
        additionalNames.sort();
        // 組織に追加された項目と任意機能の項目を分類
        for (String name : additionalNames) {
            // 項目ごとの参照権限と API 名を解決
            Schema.DescribeFieldResult field = USER_FIELDS.get(name).getDescribe();
            // 定義済みの項目順は維持
            if (!groups.containsKey(field.getName()) && isFormField(field)) {
                addAdditionalField(groups, field);
            }
        }
        // 読み取り・保存で同じ項目集合を共有
        return groups;
    }

    private Boolean isFormField(Schema.DescribeFieldResult field) {
        // 暗号化項目の値は参照権限にかかわらず取得・保存の許可リストから外す
        return field.isAccessible() && !field.isEncrypted() && field.getType() != Schema.DisplayType.EncryptedString;
    }

    private void addStandardFields(Map<String,String> groups, List<String> parts) {
        // この組織・実行者で利用できる標準項目のみを表示
        for (String name : parts[1].split(' ')) {
            // ライセンスはプロファイルから取得する派生項目
            Schema.SObjectField token = USER_FIELDS.get(name);
            // 住所文字列と選択リストの二重表示を防止
            if (name == 'UserLicenseId' || (token != null && isFormField(token.getDescribe()) && !hasAddressCode(name))) {
                groups.put(name, parts[0]);
                // 表示の行順は Map と独立して保持
                orderedNames.add(name);
            }
        }
    }

    private void addAdditionalField(Map<String,String> groups, Schema.DescribeFieldResult field) {
        // カスタム項目は計算項目を含め参照できるものを表示
        if (field.isCustom()) {
            groups.put(field.getName(), 'カスタム項目');
            // ラベルの五十音順は画面側で組み立てる
            orderedNames.add(field.getName());
            return;
        }
        // 標準画面の編集属性だけを追加し、個人設定・認証情報は省く
        String name = field.getName();
        // ユーザーの機能別権限をまとめて表示
        if (isAdditionalStandard(field) && (field.isCreateable() || field.isUpdateable())) {
            groups.put(name, name.toLowerCase().startsWith('userpermissions') ? 'ユーザー権限' : 'その他の標準項目');
            // 設定画面に近い順序の後に追加する
            orderedNames.add(name);
        }
    }

    private Boolean isAdditionalStandard(Schema.DescribeFieldResult field) {
        // 個人設定、認証・ログイン情報、システム識別情報は入力対象外
        String name = field.getName();
        // 認証情報や複合項目を汎用入力として公開しない
        return !EXCLUDED_STANDARD.matcher(name).find() && !hasAddressCode(name) && getInputType(field) != 'readonly';
    }

    private Boolean hasAddressCode(String name) {
        // 州・国を入力する場合だけ選択リストの有無を確認
        if (name != 'Country' && name != 'State') {
            return false;
        }
        // 有効な選択リストを優先
        Schema.SObjectField code = USER_FIELDS.get(name + 'Code');
        return code != null && code.getDescribe().isAccessible();
    }

    /**
     * 表示および保存に使用する項目の入力型を決定
     * @param field 利用者の権限で取得した項目定義
     * @return 入力型、固定項目または未対応型の場合は readonly
     */
    public static String getInputType(Schema.DescribeFieldResult field) {
        // 固定項目、計算項目、番号自動採番は参照のみ
        if (LOCKED.contains(field.getName()) || field.isCalculated() || field.isAutoNumber()) {
            return 'readonly';
        }
        // 複数の参照先を持つ項目は選択対象を限定できない
        if (field.getType() == Schema.DisplayType.Reference && field.getReferenceTo().size() != 1) {
            return 'readonly';
        }
        // 対応外の複合項目も値の参照だけ許可
        String type = INPUT_TYPES.get(String.valueOf(field.getType()).toUpperCase());
        // 未対応型に自由入力を許可しない
        return type == null ? 'readonly' : type;
    }

    /**
     * 新規作成時に入力が必要な項目を判定
     * @param field 表示項目の定義
     * @return 利用者に値の指定を求める場合に true
     */
    public static Boolean isRequired(Schema.DescribeFieldResult field) {
        // システム既定値を持つ項目に過剰な入力を要求しない
        return REQUIRED.contains(field.getName()) || (field.getType() != Schema.DisplayType.Boolean
            && !field.isNillable() && !field.isDefaultedOnCreate() && field.isCreateable());
    }

    /**
     * フォーム項目の正規の User 項目定義を返す
     * @param name 確認済みの API 名
     * @return 項目の名前・型・権限
     */
    public static Schema.DescribeFieldResult getUserField(String name) {
        // 呼び出しごとの同じ項目一覧の再取得を回避
        return USER_FIELDS.get(name).getDescribe();
    }
    /**
     * ユーザー作成時に既定値に依存せず入力する固定項目を取得
     * @return 呼び出し側から定義を変更できない項目名のコピー
     */
    public static Set<String> getRequiredNames() {
        // 画面と保存で同じ必須項目の定義を使う
        return REQUIRED.clone();
    }

    /**
     * 単一の参照先でアクセス可能な表示名のリレーションを取得
     * @param field 参照表示を組み立てる項目
     * @return Name 項目を取得できるリレーション名
     */
    public static String getNamedRelation(Schema.DescribeFieldResult field) {
        // 多態参照は名称取得の対象外
        if (field.getType() != Schema.DisplayType.Reference || field.getReferenceTo().size() != 1) {
            return null;
        }
        // 関連先自体と名称の参照可否を検証
        Schema.DescribeSObjectResult target = field.getReferenceTo()[0].getDescribe(SObjectDescribeOptions.DEFERRED);
        // Name のないオブジェクトでは参照IDを保持
        Schema.SObjectField nameField = target.fields.getMap().get('Name');
        // 関連先の共有は照会時のユーザーモードで適用
        return target.isAccessible() && nameField != null && nameField.getDescribe().isAccessible()
            ? field.getRelationshipName() : null;
    }

}
