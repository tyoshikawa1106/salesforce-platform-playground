/** ユーザー作成時の表示項目・固定項目・権限割り当ての組み立て */
public with sharing class UserCreateAssistantService {
    // 日付・日時・時刻の値だけを標準の JSON 形式に変換
    private static final Set<String> TEMPORAL_TYPES = new Set<String>{'datetime','time','date'};

    /**
     * 表示項目に対応する検証済みの SOQL 投影を生成
     * @param orderedNames Describe で参照可能と判定した標準画面順の項目
     * @return User の項目と参照先の表示項目
     */
    public List<String> getQueryFields(List<String> orderedNames) {
        // 固定ライセンスの参照先を追加
        List<String> columns = new List<String>{'Id', 'ContactId'};
        // 関連先の表示名を取得できない場合も基本フォームを使用可能にする
        if (Profile.UserLicenseId.getDescribe().isAccessible() && UserLicense.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible()
            && UserLicense.Name.getDescribe().isAccessible()) {
            columns.add('Profile.UserLicense.Name');
        }
        // プロファイルとそのライセンスの二段の参照を確保
        Integer remainingRelations = 53;
        // 要求した各項目と参照先の名称を一度に取得
        for (String name : orderedNames) {
            // 固定ライセンスの値は関連先から取得済み
            if (name == 'UserLicenseId') {
                continue;
            }
            // 項目識別子はスキーマから取り出す
            Schema.DescribeFieldResult field = UserCreateAssistantFieldCatalog.getUserField(name);
            // 値そのものは固定参照のIDも含めて使用
            columns.add(field.getName());
            // 単一参照先の表示名が照会できる場合だけ追加
            String relation = UserCreateAssistantFieldCatalog.getNamedRelation(field);
            // アクセス可能な参照名を追加
            if (relation != null && remainingRelations > 0) {
                columns.add(relation + '.Name');
                // 子から親への参照数が SOQL の上限を超えないようにする
                remainingRelations--;
            }
        }
        // クエリに展開する項目だけを返却
        return columns;
    }

    /**
     * 選択済みユーザーの表示行を構築
     * @param groups 標準・カスタムの表示区分
     * @param orderedNames 標準画面に準じた表示順
     * @param sources 選択したコピー元の照会結果
     * @return 元の値と入出力条件を含む表示用データ
     */
    public UserCreateAssistantWrapper createForm(Map<String,String> groups, List<String> orderedNames, List<User> sources) {
        // 未選択または不可視のユーザーを拒否
        User source = requireSource(sources);
        // 利用者に表示する行をまとめる
        UserCreateAssistantWrapper form = new UserCreateAssistantWrapper();
        // 同じ表示規約で各行を整形
        FieldPresentation presentation = new FieldPresentation(source);
        // 画面用の値はサーバーで許可した項目だけから生成
        for (String name : orderedNames) {
            // 読み取り専用の派生ライセンスを表示
            if (name == 'UserLicenseId') {
                // ライセンス情報を取得できた場合だけ表示名を使用
                String license = presentation.getLicenseName();
                // 利用者向けにライセンスの名前を返す
                form.fields.add(new Map<String,Object>{
                    'apiName'=>name, 'groupLabel'=>groups.get(name), 'label'=>'ユーザーライセンス',
                    'type'=>'readonly', 'displayValue'=>license ?? '参照不可', 'value'=>license,
                    'canCreate'=>false, 'canUpdate'=>false, 'required'=>false, 'custom'=>false
                });
            } else {
                // 通常の項目は Describe と保存済み値から生成
                form.fields.add(presentation.createRow(UserCreateAssistantFieldCatalog.getUserField(name), groups.get(name)));
            }
        }
        // 行の一覧を返却
        return form;
    }

    /** 項目型・参照先・選択肢に応じた既存値と入力条件の表示 */
    private class FieldPresentation {
        private final Map<String,Object> values;

        /**
         * 照会したユーザーの項目値と関連レコードを表示行間で共有
         * @param source 参照権限に従って取得したコピー元
         */
        private FieldPresentation(User source) {
            values = source.getPopulatedFieldsAsMap();
        }

        private String getLicenseName() {
            SObject profile = (SObject)values.get('Profile');
            SObject license = (SObject)profile?.getPopulatedFieldsAsMap().get('UserLicense');
            return (String)license?.get('Name');
        }

        private Map<String,Object> createRow(Schema.DescribeFieldResult field, String groupLabel) {
            // 型と編集可否の判定に正規の識別子を使用
            String name = field.getName();
            // 参照項目や選択リストでは表示と入力の値を区別
            String inputType = UserCreateAssistantFieldCatalog.getInputType(field);
            // Apex 固有の日時表現をクライアントに渡さない
            String raw = formatValue(values.get(name), inputType);
            // 取得できた関連先名を優先
            String display = raw;
            // 関連レコードを取得できた項目だけ、名称を表示できるか照合
            SObject related = (SObject)values.get(field.getRelationshipName());
            if (related != null && UserCreateAssistantFieldCatalog.getNamedRelation(field) != null) {
                display = (String)related.get('Name');
            }
            // 選択肢のラベルを入力と表示の双方で使用
            List<Map<String,String>> options = new List<Map<String,String>>();
            // 選択リストだけ候補を展開
            if (inputType == 'picklist' || inputType == 'multipicklist') {
                display = formatChoices(field, raw, options);
            }
            // サーバーとクライアントで同じ固定条件を使用
            Boolean editable = inputType != 'readonly';
            // 項目型と行の権限を明示
            return new Map<String,Object>{
                'apiName'=>name,'label'=>field.getLabel(),'groupLabel'=>groupLabel,'custom'=>field.isCustom(),
                'type'=>field.getType() == Schema.DisplayType.Boolean ? 'checkbox' : inputType,
                'value'=>raw,'displayValue'=>display,'required'=>UserCreateAssistantFieldCatalog.isRequired(field),
                'canCreate'=>editable && field.isCreateable(),'canUpdate'=>editable && name != 'IsActive' && field.isUpdateable(),
                'richText'=>field.getType() == Schema.DisplayType.TextArea && field.isHtmlFormatted(),
                'controllerName'=>field.getController()?.getDescribe().getName(),
                'options'=>options,'referenceTo'=>inputType == 'reference' ? field.getReferenceTo()[0].getDescribe(SObjectDescribeOptions.DEFERRED).getName() : null,
                'maxLength'=>field.getLength(),'scale'=>field.getScale()
            };
        }

        private String formatChoices(Schema.DescribeFieldResult field, String raw, List<Map<String,String>> options) {
            // 保存済みの選択値だけをラベル変換の対象とし、複数選択の順序を保持
            List<String> selected = String.isBlank(raw) ? new List<String>() : raw.split(';');
            Map<String,String> labels = new Map<String,String>();
            for (String value : selected) {
                labels.put(value, value);
            }
            for (Schema.PicklistEntry entry : field.getPicklistValues()) {
                String value = entry.getValue();
                String label = entry.getLabel();
                if (entry.isActive()) {
                    options.add(new Map<String,String>{'value'=>value, 'label'=>label});
                }
                // 無効化済みの選択値も元ユーザーの表示名に変換
                if (labels.containsKey(value)) {
                    labels.put(value, label);
                }
            }
            for (Integer i = 0; i < selected.size(); i++) {
                selected[i] = labels.get(selected[i]);
            }
            return selected.isEmpty() ? null : String.join(selected, '、');
        }

        private String formatValue(Object value, String inputType) {
            // 空値を文字列 null として表示しない
            if (value == null) {
                return null;
            }
            // 日付・日時・時刻を標準の入力形式にする
            if (TEMPORAL_TYPES.contains(inputType)) {
                return (String) JSON.deserializeUntyped(JSON.serialize(value));
            }
            // それ以外のスカラーは画面に渡せる文字列にそろえる
            return String.valueOf(value);
        }

    }

    private static User requireSource(List<User> sources) {
        // 不可視レコードと未選択を同じ案内にする
        if (sources == null || sources.isEmpty() || sources[0].ContactId != null) {
            throw new AuraHandledException('コピー元ユーザーを選び直してください。');
        }
        // 選択 ID で絞った唯一の行を使用
        return sources[0];
    }

    /**
     * 元ユーザーの無効化または固定値付きの新規ユーザーを組み立てる
     * @param sources 保存直前に取得したコピー元
     * @param changesJson API 名から利用者が入力した値への JSON オブジェクト
     * @param inputSide 元ユーザーの無効化または新規作成
     * @return 明示的に入力された項目とサーバーで決定した項目を持つ User
     */
    public User prepareUser(List<User> sources, String changesJson, UserCreateAssistantFieldInput.Side inputSide) {
        // コピー元が存在することを保存直前に再確認
        User source = requireSource(sources);
        // 作成時のプロファイルは必ず元ユーザーから取得
        User record = inputSide == UserCreateAssistantFieldInput.Side.SOURCE ? new User(Id=source.Id, IsActive=false) : new User(ProfileId=source.ProfileId);
        // ロールなしのコピー元ではロールを未設定にする
        if (inputSide == UserCreateAssistantFieldInput.Side.TARGET && source.UserRoleId != null) {
            record.UserRoleId = source.UserRoleId;
        }
        // 無効化は実行者本人への操作を許可しない
        if (inputSide == UserCreateAssistantFieldInput.Side.SOURCE && source.Id == UserInfo.getUserId()) {
            throw new AuraHandledException('ログイン中のユーザーは無効化できません。');
        }
        // 実行者の項目権限と入力形式を照合して適用
        new UserCreateAssistantFieldInput().applyChanges(record, changesJson, inputSide);
        // 疎な更新レコードまたは固定値付き新規レコードを返却
        return record;
    }

    /**
     * 引き継ぐ直接割り当てとグループの割り当てを重複を除いて用意
     * @param request サーバーが確定した新規ユーザー ID と引き継ぎ設定
     * @param assignments コピー元を更新する前の有効な割り当て
     * @param existing 自動付与等により新規ユーザーに存在する割り当て
     * @return 期限を維持した新規割り当て
     */
    public List<PermissionSetAssignment> createAssignments(UserCreateAssistantWrapper request, List<PermissionSetAssignment> assignments,
        List<PermissionSetAssignment> existing) {
        // グループ割り当てと個別の割り当てを別々に識別
        Set<Id> assigned = new Set<Id>();
        // 作成時の自動付与と二重登録しない
        for (PermissionSetAssignment item : existing) {
            assigned.add(item.PermissionSetGroupId ?? item.PermissionSetId);
        }
        // 一括登録する新しい割り当てを収集
        List<PermissionSetAssignment> records = new List<PermissionSetAssignment>();
        // コピー元の有効な割り当てだけを処理
        for (PermissionSetAssignment item : assignments) {
            // グループは構成する個別権限に展開しない
            Boolean isGroup = item.PermissionSetGroupId != null;
            // 同じ権限の割り当てがすでにあれば維持
            Id key = item.PermissionSetGroupId ?? item.PermissionSetId;
            // 有効期限を過ぎた権限を再付与しない
            if (!shouldAssign(item, request) || key == null || assigned.contains(key)) {
                continue;
            }
            // 割り当て先に応じてグループまたは単独の権限セットを関連付け
            PermissionSetAssignment record = new PermissionSetAssignment(AssigneeId=request.targetId);
            // 対象に対して有効な方の外部キーだけを設定
            record.put(isGroup ? 'PermissionSetGroupId' : 'PermissionSetId', key);
            // 期限のない割り当てに任意の期限を補完しない
            if (item.ExpirationDate != null) {
                record.ExpirationDate = item.ExpirationDate;
            }
            // 登録対象と付与済み一覧をそろえる
            records.add(record);
            // 同一要求内での重複も除外
            assigned.add(key);
        }
        // 実行者権限でまとめて登録する
        return records;
    }

    private Boolean shouldAssign(PermissionSetAssignment item, UserCreateAssistantWrapper request) {
        // 取得後に期限切れとなった権限を新規ユーザーへ再付与しない
        if (item.ExpirationDate != null && item.ExpirationDate <= System.now()) {
            return false;
        }
        // グループ由来の割り当てと直接付与を区別
        return (item.PermissionSetGroupId != null ? request.copyPermissionSetGroups : request.copyPermissionSets) == true;
    }
}
