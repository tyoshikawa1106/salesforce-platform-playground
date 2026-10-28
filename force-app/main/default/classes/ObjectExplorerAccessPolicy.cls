/** データ分類操作の権限と参照対象を検証 */
public with sharing class ObjectExplorerAccessPolicy {

    /**
     * 分類編集専用の権限を必須にする
     */
    public void requireAccess() {
        if (!FeatureManagement.checkPermission('ManageObjectFieldClassification')) {
            throw ObjectExplorerAccessPolicy.createException('データ分類設定には権限セット「LWC：オブジェクトエクスプローラー」が必要です。');
        }
    }

    /**
     * 参照可否確認済みの対象から項目の参照・編集可否を検証
     * @param info 同じ要求で参照可否を確認したオブジェクト定義
     * @param token その定義の項目Mapから取得した項目、未存在はnull
     * @return 一度だけDescribeした検証済みの項目定義
     */
    public Schema.DescribeFieldResult validateField(Schema.DescribeSObjectResult info, Schema.SObjectField token) {
        // 一項目のDescribeは権限確認と更新判定で共用
        Schema.DescribeFieldResult field = token?.getDescribe();
        // 未存在と参照不可は同じ公開エラーで拒否
        if (field?.isAccessible() != true) { throw createException('対象項目を参照できません。'); }
        // 権限確認済みのオブジェクト定義を編集対象判定に再利用
        if (!isEditable(info, field)) { throw createException('この種類の項目は分類編集の対象外です。'); }
        // 同じ項目の検証結果だけを保存段へ渡す
        return field;
    }

    /**
     * オブジェクトの存在と参照可否を共通に確認
     * @param objectName 対象オブジェクトのAPI名
     * @return 存在と参照権限を確認したオブジェクト型
     */
    public Schema.SObjectType requireObject(String objectName) {
        // 一覧と項目編集で同じオブジェクトを解決
        Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectName);
        // 未存在と権限不足は同じ公開エラーで拒否
        if (objectType?.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible() != true) { throw createException('対象オブジェクトを参照できません。'); }
        // 後続のDescribeは検証済みの型から実行
        return objectType;
    }

    /**
     * 管理パッケージや設定用の項目を編集対象から除外
     * @param info 参照可否確認済みのオブジェクト定義
     * @param field 対象項目
     * @return 標準項目または未管理カスタム項目の場合true
     */
    public static Boolean isEditable(Schema.DescribeSObjectResult info, Schema.DescribeFieldResult field) {
        Boolean localField = !field.isCustom() || (field.getName().endsWith('__c') && field.getName().countMatches('__') == 1);
        Boolean localObject = !info.isCustom() || info.getName().countMatches('__') == 1;
        return localField && localObject && !info.isCustomSetting() && !info.getName().endsWith('__mdt');
    }

    /**
     * 個別結果へ変換しても説明が失われない公開例外を生成
     * @param message サーバー側で定義した案内
     * @return 公開用の例外
     */
    public static AuraHandledException createException(String message) {
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }

    /**
     * 変更した分類が組織の有効な選択肢に含まれることを確認
     * @param key 分類属性名
     * @param value 編集後の値
     * @param options 組織の分類候補
     */
    public void validateOption(String key, String value, Map<String, Object> options) {
        Map<String, String> names = new Map<String, String>{'complianceGroup' => 'ComplianceGroup', 'securityClassification' => 'SecurityClassification', 'businessStatus' => 'BusinessStatus'};
        if (!names.containsKey(key) || String.isBlank(value)) { return; }
        Set<String> allowed = new Set<String>();
        for (Map<String, String> item : (List<Map<String, String>>)options.get(names.get(key))) { allowed.add(item.get('value')); }
        List<String> selected = key == 'complianceGroup' ? value.split(';') : new List<String>{value};
        if (!allowed.containsAll(selected)) { throw ObjectExplorerAccessPolicy.createException('選択肢にない分類値が指定されています。再取得してください。'); }
    }

    /**
     * 分類の変更操作には標準のオブジェクトカスタマイズ権限を必須にする
     * @param records 実行ユーザー自身の実効権限
     */
    public void requireCustomization(List<UserPermissionAccess> records) {
        // 権限の取得不足と権限なしはどちらも更新させない
        if (records?.size() != 1 || records[0].PermissionsCustomizeApplication != true) {
            throw createException('データ分類の変更には「オブジェクトのカスタマイズ」権限が必要です。');
        }
    }
    /**
     * JSON配列の入力サイズ・構文・型を同じ境界で確認
     * @param inputJson 外部から受け取る配列JSON
     * @param maxLength 展開前の文字数上限
     * @param message 入力不正時の固定の公開案内
     * @return 型と大きさを確認済みの未加工配列
     */
    public List<Object> readJsonArray(String inputJson, Integer maxLength, String message) {
        // 過大な要求をJSON展開より前に拒否
        if (inputJson?.length() > maxLength) { throw createException(message); }
        // 解析結果の型を入力値から推測しない
        Object parsed;
        try {
            // JSONの構文検証だけを標準APIへ委譲
            parsed = JSON.deserializeUntyped(inputJson);
        } catch (Exception error) {
            // JSON解析の失敗やnullを公開入力エラーに統一
            throw createException(message);
        }
        // オブジェクトやnullを空配列へ補完しない
        if (!(parsed instanceof List<Object>)) { throw createException(message); }
        // 以降の件数・行・ID検証に同じ配列を使用
        return (List<Object>)parsed;
    }

    /** 保存要求の形・項目名・定義IDを更新前に確定 */
    public class RequestValidator {
        private ObjectExplorerAccessPolicy access = new ObjectExplorerAccessPolicy();

        /**
         * 更新要求の大きさ・件数・重複を検証
         * @param changesJson 画面からの変更行JSON
         * @return 検証済み変更行
         */
        public List<Object> parseChanges(String changesJson) {
            // 入力の構文や型が不正な場合も固定の公開エラーで拒否
            List<Object> changes = this.access.readJsonArray(changesJson, 200000, '変更内容が不正です。配列で指定してください。');
            // 1要求10項目のMetadata API上限を維持
            if (changes.isEmpty() || changes.size() > 10) { throw ObjectExplorerAccessPolicy.createException('保存は1リクエスト1～10項目で実行してください。'); }
            for (Object change : changes) { validateFieldRequest(change); }
            return changes;
        }

        /**
         * 更新対象の項目を明示した一行だけを受け付ける
         * @param item 更新対象の行
         */
        private void validateFieldRequest(Object item) {
            if (!(item instanceof Map<String, Object>)) { throw createException('更新する項目を指定してください。'); }
            // 一行の値は検証後も同じMapから取得
            Map<String, Object> change = (Map<String, Object>)item;
            // 表示名ではなく正式API名だけを対象識別に使用
            Object fieldName = change.get('apiName');
            if (!(fieldName instanceof String) || String.isBlank((String)fieldName)) { throw createException('更新する項目を指定してください。'); }
            // 基準値・編集値の型が違う要求をMapキャストへ渡さない
            if (!(change.get('original') instanceof Map<String, Object>) || !(change.get('draft') instanceof Map<String, Object>)) { throw createException('分類の編集内容が不正です。'); }
        }

        /**
         * 所有者を識別名や表示名で指定する更新要求を受け付けない
         * @param draft 分類3属性と所有者IDのみの編集値
         */
        public void validateOwnerDraft(Map<String, Object> draft) {
            // API参照名や表示名を更新値として受け付けない
            Set<String> allowed = new Set<String>{'complianceGroup', 'securityClassification', 'businessStatus', 'ownerId'};
            // 未指定と過不足のある属性を同じ入力エラーとして拒否
            if (draft?.keySet() != allowed) { throw ObjectExplorerAccessPolicy.createException('分類の編集内容が不正です。'); }
            // 項目ごとの型検証は所有者IDの形式検証と分離
            validateDraftValues(draft.values());
            // 型確認後だけ所有者IDを文字列として扱う
            String ownerId = (String)draft.get('ownerId');
            // 明示解除またはユーザー・公開グループIDだけを許可
            if (ownerId != '' && !Pattern.matches('(005|00G)[A-Za-z0-9]{12}([A-Za-z0-9]{3})?', ownerId)) { throw ObjectExplorerAccessPolicy.createException('所有者のIDが不正です。候補から選択し直してください。'); }
        }

        /**
         * 分類入力を暗黙に変換せず文字列として検証
         * @param values 許可した4属性の入力値
         */
        private void validateDraftValues(List<Object> values) {
            // nullや別型を解除値へ変換しない
            for (Object value : values) {
                // すべての分類属性で同じ入力契約を適用
                if (!(value instanceof String)) { throw ObjectExplorerAccessPolicy.createException('分類の編集内容が不正です。'); }
            }
        }

        /**
         * 形式確認済みIDをSalesforceの正規表記へ統一
         * @param ownerId ユーザー・公開グループID、未設定は空文字
         * @return 比較用のID、未設定は空文字
         */
        public String normalizeOwnerId(String ownerId) {
            // 15桁と18桁の同じ所有者を競合と誤判定しない
            return ownerId == '' ? '' : String.valueOf((Id)ownerId);
        }

        /**
         * 編集対象と入力形式を確認して項目別の状態を生成
         * @param info 参照可否確認済みのオブジェクト定義
         * @param changes 件数・形式確認済みの編集要求
         * @return 入力順を維持した同じ項目の状態
         */
        public List<ObjectExplorerClassifyService.FieldContext> createFieldContexts(Schema.DescribeSObjectResult info, List<Object> changes) {
            // 全項目で同じ検証済み対象の正式名を使用
            String objectName = info.getName();
            // オブジェクトの項目Mapは保存要求につき一度だけ取得
            Map<String, Schema.SObjectField> fields = info.fields.getMap();
            // 要求内で同じ項目を重複させない
            Set<String> names = new Set<String>();
            // 入力順を照合用の状態へ維持
            List<ObjectExplorerClassifyService.FieldContext> contexts = new List<ObjectExplorerClassifyService.FieldContext>();
            // 全対象を更新前に確定
            for (Object item : changes) {
                // 一項目の要求だけを取り出す
                Map<String, Object> change = (Map<String, Object>)item;
                // 表記と参照・編集可否をDescribeで確定
                Schema.DescribeFieldResult field = this.access.validateField(info, fields.get((String)change.get('apiName')));
                // 大文字小文字の異なる同じ項目も二重に更新しない
                if (names.contains(field.getName())) { throw ObjectExplorerAccessPolicy.createException('同じ項目を重複して保存できません。'); }
                // 基準値と編集値の型・所有者ID形式を確認
                validateOwnerDraft((Map<String, Object>)change.get('original'));
                // 編集後の所有者も同じ入力契約で確認
                validateOwnerDraft((Map<String, Object>)change.get('draft'));
                // 検証した対象と入力を同じ状態へ格納
                ObjectExplorerClassifyService.FieldContext context = new ObjectExplorerClassifyService.FieldContext();
                // 検証済みの対象オブジェクトを固定
                context.objectName = objectName;
                // 正式な項目名を固定
                context.fieldName = field.getName();
                // 入力の基準値と編集値を保持
                context.change = change;
                // Describeで確定した通信方式を保持
                context.customField = field.isCustom();
                // API応答順と切り離して入力順を維持
                contexts.add(context);
                // 同じ要求内の重複判定へ登録
                names.add(context.fieldName);
            }
            return contexts;
        }

        /**
         * 取得した定義の件数と名前を照合して同じ項目へ対応付け
         * @param contexts 検証済み保存要求
         * @param records 一括取得した項目定義
         * @return 完全な識別子を保持した新しい状態
         */
        public List<ObjectExplorerClassifyService.FieldContext> bindDefinitions(List<ObjectExplorerClassifyService.FieldContext> contexts, List<FieldDefinition> records) {
            // レコードの重複を索引化で隠さない
            Map<String, FieldDefinition> definitions = new Map<String, FieldDefinition>();
            for (FieldDefinition record : records) {
                // 一意でない項目の更新先を推測しない
                if (definitions.containsKey(record.QualifiedApiName)) { throw ObjectExplorerAccessPolicy.createException('項目定義を一意に取得できません。'); }
                // 確認した定義だけを索引へ登録
                definitions.put(record.QualifiedApiName, record);
            }
            // 別項目や不足した定義を採用しない
            Set<String> names = new Set<String>();
            // 検証済みの入力対象を定義の集合へ照合
            for (ObjectExplorerClassifyService.FieldContext context : contexts) { names.add(context.fieldName); }
            if (definitions.keySet() != names) { throw ObjectExplorerAccessPolicy.createException('項目定義を一意に取得できません。'); }
            // 入力された状態を変更せず照合済みの新しい状態を返す
            List<ObjectExplorerClassifyService.FieldContext> result = new List<ObjectExplorerClassifyService.FieldContext>();
            for (ObjectExplorerClassifyService.FieldContext source : contexts) {
                // 同じ項目の完全IDだけを引き継ぐ
                ObjectExplorerClassifyService.FieldContext context = new ObjectExplorerClassifyService.FieldContext(source);
                // 同じAPI名の完全IDを関連付け
                context.definition = definitions.get(context.fieldName);
                // 入力順で新しい状態を追加
                result.add(context);
            }
            // 生成した照合結果を返却
            return result;
        }
    }

    /**
     * 組織に存在する分類候補をDescribeから取得
     * @return 分類ごとの選択肢
     */
    public Map<String, Object> getOptions() {
        Map<String, Schema.SObjectField> fields = Schema.SObjectType.FieldDefinition.fields.getMap();
        Map<String, Object> options = new Map<String, Object>();
        for (String name : new List<String>{'ComplianceGroup', 'SecurityClassification', 'BusinessStatus'}) {
            // 一つの選択リストの有効な選択肢だけを生成
            List<Map<String, String>> values = createPicklistChoices(fields.get(name));
            options.put(name, values);
        }
        return options;
    }

    /**
     * 一つの選択リストの有効値と利用者言語のラベルを取得
     * @param field 組織定義の選択リスト項目
     * @return 有効な選択肢の値とラベル
     */
    private List<Map<String, String>> createPicklistChoices(Schema.SObjectField field) {
        // 画面の順序を組織定義に合わせる
        List<Map<String, String>> values = new List<Map<String, String>>();
        // 有効な候補だけを入力検証と画面で共用
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            // 廃止された選択肢を新規指定させない
            if (entry.isActive()) { values.add(new Map<String, String>{'label' => entry.getLabel(), 'value' => entry.getValue()}); }
        }
        // 既存値の保持は呼出元で明示的に扱う
        return values;
    }

    /**
     * 現在保存済みの分類を維持できる検証候補を生成
     * @param original 編集開始時の分類
     * @return 有効な候補と既存の複数選択値
     */
    public Map<String, Object> createValidationOptions(Map<String, Object> original) {
        Map<String, Object> options = getOptions();
        String compliance = (String)original.get('complianceGroup');
        if (String.isBlank(compliance)) { return options; }
        List<Map<String, String>> values = (List<Map<String, String>>)options.get('ComplianceGroup');
        for (String value : compliance.split(';')) { values.add(new Map<String, String>{'label' => value, 'value' => value}); }
        return options;
    }

    }
