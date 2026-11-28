/** User の標準・カスタム項目の分類と入力型の決定 */
public with sharing class UserCreateAssistantFieldCatalog {
    // ユーザー編集ページに対応する項目をセクション順に列挙
    private static final List<String> STANDARD_GROUPS = new List<String>{
        '一般情報|LastName UserRoleId FirstName UserLicenseId Alias ProfileId Email IsActive Username UserPermissionsMarketingUser CommunityNickname UserPermissionsOfflineUser Title UserPermissionsKnowledgeUser CompanyName UserPermissionsInteractionUser Department UserPermissionsSupportUser Division UserPermissionsSiteforceContributorUser UserPermissionsSiteforcePublisherUser UserPermissionsWorkDotComUserFeature UserPermissionsJigsawProspectingUser JigsawImportLimitOverride UserPermissionsSFContentUser ForecastEnabled CallCenterId Phone Extension Fax MobilePhone EmailEncodingKey EmployeeNumber IndividualId',
        '住所(郵送先)|CountryCode Country PostalCode StateCode State City Street',
        'シングルサインオン情報|FederationIdentifier',
        '地域の設定|TimeZoneSidKey LocaleSidKey LanguageLocaleKey',
        '承認者の設定|DelegatedApproverId ManagerId',
        'その他の標準項目|MiddleName Suffix DefaultCurrencyIsoCode'
    };
    // 従来から書き込み可能な場合だけ表示している任意機能の項目
    private static final Set<String> OPTIONAL_LAYOUT_FIELDS = new Set<String>{
        'UserPermissionsWorkDotComUserFeature', 'UserPermissionsJigsawProspectingUser', 'JigsawImportLimitOverride'
    };
    // 標準項目の表示順と、個別の項目名から参照できるセクション定義
    private static final List<String> STANDARD_NAMES = new List<String>();
    private static final Map<String,String> STANDARD_SECTIONS = new Map<String,String>();
    // 固定項目はサーバーが選択元の保存済み値から解決
    private static final Set<String> LOCKED = new Set<String>{'ProfileId', 'UserRoleId', 'UserLicenseId'};
    // 組織の既定値があっても画面で明示的に指定する基本項目
    private static final Set<String> REQUIRED = new Set<String>{
        'LastName','Alias','Email','Username','TimeZoneSidKey','LocaleSidKey','LanguageLocaleKey','EmailEncodingKey','IsActive'
    };
    // 管理画面以外の標準属性、認証やログインに関わる派生属性を除外
    private static final Pattern EXCLUDED_STANDARD = Pattern.compile(
        '(?i)^userpreferences|^emailpreferences|password|token|digest|auth|secret|portal|verified|^(id|contactid|name|address|userrecordaccessid|senderemail)$'
    );
    // 複合位置と暗号化テキストは表示・保存の対象外
    private static final Set<Schema.DisplayType> EXCLUDED_TYPES = new Set<Schema.DisplayType>{
        Schema.DisplayType.EncryptedString, Schema.DisplayType.Location
    };
    // 基本入力と Salesforce の型の対応
    private static final Map<String,String> INPUT_TYPES = new Map<String,String>{
        'STRING'=>'text','TEXTAREA'=>'textarea','EMAIL'=>'email','URL'=>'url','PHONE'=>'tel',
        'INTEGER'=>'number','LONG'=>'number','DOUBLE'=>'number','CURRENCY'=>'number','PERCENT'=>'number',
        'DATE'=>'date','DATETIME'=>'datetime','TIME'=>'time','BOOLEAN'=>'checkbox','PICKLIST'=>'picklist',
        'MULTIPICKLIST'=>'multipicklist','REFERENCE'=>'reference','COMBOBOX'=>'text'
    };
    // 同じ要求の項目検証と表示で利用する User の Describe
    private static final Map<String, Schema.SObjectField> USER_FIELDS = User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap();

    // 組織で住所コードを参照できる場合は、対応する住所文字列の重複表示を防ぐ
    private static final Map<String,Schema.SObjectField> ADDRESS_CODES = new Map<String,Schema.SObjectField>{
        'State' => USER_FIELDS.get('StateCode'), 'Country' => USER_FIELDS.get('CountryCode')
    };

    // 標準画面の順序と照会での優先順を明示した項目名一覧
    public List<String> orderedNames { get; private set; }

    static {
        for (String definition : STANDARD_GROUPS) {
            List<String> parts = definition.split('\\|');
            for (String name : parts[1].split(' ')) {
                STANDARD_NAMES.add(name);
                STANDARD_SECTIONS.put(name, parts[0]);
            }
        }
    }

    /**
     * 実行者が参照できる画面項目を標準の区分に対応付ける
     * @return API 名からセクション表示名への対応
     */
    public Map<String,String> getFieldGroups() {
        // 繰り返し取得しても以前の項目名を残さない
        orderedNames = new List<String>();
        Map<String,String> groups = new Map<String,String>();
        Set<String> remainingNames = USER_FIELDS.keySet().clone();
        // 設定画面の順序で標準項目を登録
        for (String name : STANDARD_NAMES) {
            // Describe のキーは小文字。標準項目の再分類を省く
            remainingNames.remove(name.toLowerCase());
            if (name == 'UserLicenseId') {
                groups.put(name, STANDARD_SECTIONS.get(name));
                orderedNames.add(name);
            } else {
                addFormField(groups, name);
            }
        }
        // 組織固有の項目も安定した順序で追加
        List<String> additionalNames = new List<String>(remainingNames);
        additionalNames.sort();
        for (String name : additionalNames) {
            // カスタム項目（緯度・経度を含む）は個別に判定し、対象外の標準名は Describe 前に除外
            if (name.contains('__') || !EXCLUDED_STANDARD.matcher(name).find()) {
                addFormField(groups, name);
            }
        }
        return groups;
    }

    private void addFormField(Map<String,String> groups, String name) {
        Schema.DescribeFieldResult field = getUserField(name);
        // 組織で利用できる項目だけを分類
        if (field == null) {
            return;
        }
        String groupLabel = getFormGroup(field);
        if (groupLabel != null) {
            groups.put(field.getName(), groupLabel);
            orderedNames.add(field.getName());
        }
    }

    /**
     * 実行者がフォームで参照できる実項目の所属セクションを判定
     * @param field 検証する User 項目の定義
     * @return 表示対象のセクション、または対象外なら null
     */
    public static String getFormGroup(Schema.DescribeFieldResult field) {
        String name = field.getName();
        if (!isFormField(field) || ADDRESS_CODES.get(name)?.getDescribe().isAccessible() == true) {
            return null;
        }
        if (STANDARD_SECTIONS.containsKey(name) && !OPTIONAL_LAYOUT_FIELDS.contains(name)) {
            return STANDARD_SECTIONS.get(name);
        }
        if (field.isCustom()) {
            return 'カスタム項目';
        }
        if (isAdditionalStandard(field) && (field.isCreateable() || field.isUpdateable())) {
            return STANDARD_SECTIONS.get(name) ?? 'その他の標準項目';
        }
        return null;
    }

    private static Boolean isFormField(Schema.DescribeFieldResult field) {
        // 暗号化項目を除外し、地理位置情報は緯度・経度の数値項目だけを扱う
        return field.isAccessible() && !field.isEncrypted() && !EXCLUDED_TYPES.contains(field.getType());
    }

    private static Boolean isAdditionalStandard(Schema.DescribeFieldResult field) {
        // 個人設定、認証・ログイン情報、システム識別情報は入力対象外
        String name = field.getName();
        // 認証情報や複合項目を汎用入力として公開しない
        return !EXCLUDED_STANDARD.matcher(name).find() && getInputType(field) != 'readonly';
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
        // 代理承認者は User・Group のどちらも指定できる ID 入力にする
        if (field.getType() == Schema.DisplayType.Reference && field.getReferenceTo().size() != 1) {
            return field.getName() == 'DelegatedApproverId' ? 'referenceId' : 'readonly';
        }
        // 対応外の複合項目も値の参照だけ許可
        String type = INPUT_TYPES.get(String.valueOf(field.getType()).toUpperCase());
        // 未対応型に自由入力を許可しない
        return type ?? 'readonly';
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
     * @param name 照会する API 名
     * @return 項目の名前・型・権限、または未定義なら null
     */
    public static Schema.DescribeFieldResult getUserField(String name) {
        // 呼び出しごとの同じ項目一覧の再取得を回避
        return USER_FIELDS.get(name)?.getDescribe();
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