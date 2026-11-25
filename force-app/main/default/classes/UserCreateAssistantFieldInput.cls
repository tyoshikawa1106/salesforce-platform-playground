/** 画面入力の検証、型変換とユーザー項目への設定 */
public with sharing class UserCreateAssistantFieldInput {
    // JSON の数値を Salesforce が要求する精度の Apex 型に変換
    private static final Map<Schema.DisplayType,Type> NUMBER_TYPES = new Map<Schema.DisplayType,Type>{
        Schema.DisplayType.Integer=>Integer.class, Schema.DisplayType.Long=>Long.class,
        Schema.DisplayType.Currency=>Decimal.class, Schema.DisplayType.Percent=>Decimal.class, Schema.DisplayType.Double=>Decimal.class
    };

    /** 入力内容を適用するユーザーの種別 */
    public enum Side { SOURCE, TARGET }

    /**
     * 画面入力の各項目を型・権限を検証して対象へ設定
     * @param record 元の変更用または新規作成用のレコード
     * @param changesJson 入力された値を含む JSON
     * @param inputSide 適用先の区分
     */
    public void applyChanges(User record, String changesJson, Side inputSide) {
        // 元・新規の双方で最新の権限を確認
        Map<String,String> groups = new UserCreateAssistantFieldCatalog().getFieldGroups();
        // 任意の SObject 形式を直接 DML に渡さない
        Map<String,Object> changes = readChanges(changesJson);
        // 指定された項目に限定して更新内容を構築
        for (String name : changes.keySet()) {
            // サーバー側で編集可否を再判定
            Schema.DescribeFieldResult field = requireWritable(name, groups, inputSide);
            // 項目に対応した型で値を設定
            record.put(field.getName(), convertValue(field, changes.get(name)));
        }
        // コピー元については変更された項目だけを受け付ける
        if (inputSide == Side.TARGET) {
            checkRequired(record, changes);
        }
    }

    /**
     * 新規ユーザーに必ず明示入力する項目を検証
     * @param record 型変換後の新規ユーザー
     * @param changes 画面から明示的に受け取った値
     */
    private void checkRequired(User record, Map<String,Object> changes) {
        // 新規ユーザー作成に必要な入力を検証
        for (String name : UserCreateAssistantFieldCatalog.getRequiredNames()) {
            // Salesforce の既定値による暗黙の作成を防止
            if (!changes.containsKey(name) || record.get(name) == null) {
                throw new AuraHandledException(UserCreateAssistantFieldCatalog.getUserField(name).getLabel() + ' を入力してください。');
            }
        }
    }
    private Map<String,Object> readChanges(String changesJson) {
        // 空または未指定の変更は空の疎な入力を表す
        if (String.isBlank(changesJson)) {
            return new Map<String,Object>();
        }
        // JSON の形状を確認し、レコードや配列の直接指定を拒否
        Object raw = JSON.deserializeUntyped(changesJson);
        // フォーム以外の入力形式は処理しない
        if (!(raw instanceof Map<String,Object>)) {
            throw new AuraHandledException('入力内容を確認してください。');
        }
        // サーバーの項目定義と照合する入力だけを返却
        return (Map<String,Object>)raw;
    }

    /**
     * 無効化を選択しない要求でコピー元の変更を受け取っていないことを確認
     * @param sourceValuesJson コピー元の入力値
     */
    public void checkSourceUnchanged(String sourceValuesJson) {
        // 空白・空の JSON オブジェクトを同じ変更なしとして扱う
        Map<String,Object> changes = readChanges(sourceValuesJson);
        // 参照専用時に渡された更新は拒否
        if (!changes.isEmpty()) {
            throw new AuraHandledException('コピー元を編集するには無効化を選択してください。');
        }
    }

    private Schema.DescribeFieldResult requireWritable(String name, Map<String,String> groups, Side inputSide) {
        // 標準・カスタムの表示対象、固定項目を先に検証
        if (!groups.containsKey(name) || name == 'UserLicenseId' || (inputSide == Side.SOURCE && name == 'IsActive')) {
            throw new AuraHandledException('変更できない項目が含まれています。画面を開き直してください。');
        }
        // 利用者・操作ごとの項目権限を再確認
        Schema.DescribeFieldResult field = UserCreateAssistantFieldCatalog.getUserField(name);
        // 作成・変更それぞれで許可された項目だけを扱う
        if (!canWriteField(field, inputSide)) {
            throw new AuraHandledException(field.getLabel() + ' を変更する権限を確認してください。');
        }
        // 検証済みの型で書き込む
        return field;
    }

    private Boolean canWriteField(Schema.DescribeFieldResult field, Side inputSide) {
        // 書き込み権限の判定を作成と元ユーザー更新で切り替える
        Boolean allowed = inputSide == Side.SOURCE ? field.isUpdateable() : field.isCreateable();
        // 固定・計算項目はいずれの操作でも変更不可
        return allowed && UserCreateAssistantFieldCatalog.getInputType(field) != 'readonly';
    }

    @TestVisible
    private Object convertValue(Schema.DescribeFieldResult field, Object raw) {
        // 空値は項目クリアとして扱う
        if (raw == null || String.isBlank(String.valueOf(raw))) {
            return null;
        }
        // 入れ子の構造を自由文字列として保存しない
        if (raw instanceof Map<String,Object> || raw instanceof List<Object>) {
            throw new AuraHandledException(field.getLabel() + ' の入力形式を確認してください。');
        }
        // 日時と数値は実行者のロケールに依存しない形式として解釈
        String value = String.valueOf(raw);
        // User.put に渡す型を項目ごとに確定
        switch on String.valueOf(field.getType()).toUpperCase() {
            when 'BOOLEAN' {
                // 任意の文字列を暗黙に false にしない
                if (value != 'true' && value != 'false') {
                    throw new AuraHandledException(field.getLabel() + ' を選択してください。');
                }
                return Boolean.valueOf(value);
            }
            when 'INTEGER', 'LONG', 'CURRENCY', 'PERCENT', 'DOUBLE' { return JSON.deserialize(value, NUMBER_TYPES.get(field.getType())); }
            when 'REFERENCE' { return Id.valueOf(value); }
            when 'DATE' { return Date.valueOf(value); }
            when 'DATETIME' { return JSON.deserialize(JSON.serialize(value), Datetime.class); }
            when 'TIME' { return parseTime(value); }
            when else { return value; }
        }
    }

    private Time parseTime(String value) {
        // ブラウザーの時刻入力に省略された秒・ミリ秒を補完
        Matcher parts = Pattern.compile('^(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?Z?$').matcher(value);
        // 項目以外の文字を受け付けない
        if (!parts.matches()) {
            throw new AuraHandledException('時刻を入力し直してください。');
        }
        // 小数秒をミリ秒単位へ揃える
        String fraction = (parts.group(4) == null ? '' : parts.group(4)) + '000';
        // 時・分・秒それぞれの範囲は Time で検証
        return Time.newInstance(Integer.valueOf(parts.group(1)), Integer.valueOf(parts.group(2)),
            parts.group(3) == null ? 0 : Integer.valueOf(parts.group(3)), Integer.valueOf(fraction.substring(0,3)));
    }
}
