/** データ分類の所有者ID照合・候補表示・API参照値の生成 */
public with sharing class ObjectExplorerOwnerService {

    /**
     * 取得したユーザーとグループを検索候補へ変換
     * @param users 可視な有効ユーザー
     * @param groups 可視な公開グループ
     * @return 同じレコードのIDと表示名を持つ候補
     */
    public List<Object> createOwnerChoices(List<User> users, List<Group> groups) {
        // 取得順を維持して同じ候補形式へ統合
        List<Object> rows = new List<Object>();
        // IDと表示名を別々の索引で対応付けない
        for (User record : users) { rows.add(createOwnerChoice(new List<SObject>{record})); }
        // 公開グループも同じ表示契約を使用
        for (Group record : groups) { rows.add(createOwnerChoice(new List<SObject>{record})); }
        // 元の検索結果は変更しない
        return rows;
    }

    /**
     * 最新分類と保存要求に含まれる所有者IDを集約
     * @param rows 型確認済みのAPI分類応答
     * @param changes 形式確認済みの編集要求
     * @return 現在と選択後の所有者のID集合
     */
    public Set<Id> collectRequestedOwnerIds(Map<String, Map<String, Object>> rows, List<Object> changes) {
        // 表示名やAPI参照名から候補を推測しない
        Set<Id> ids = new Set<Id>();
        // 現在の所有者を一括取得の対象へ追加
        for (Map<String, Object> row : rows.values()) {
            // 未設定には所有者レコードが不要
            if (row.get('BusinessOwnerId') != null) { ids.add((Id)(String)row.get('BusinessOwnerId')); }
        }
        // 編集で明示選択したIDだけを追加
        for (Object item : changes) {
            // 入力検証済みの一項目から所有者を取り出す
            Map<String, Object> change = (Map<String, Object>)item;
            // 表示ラベルをIDとして使用しない
            String ownerId = (String)((Map<String, Object>)change.get('draft')).get('ownerId');
            // 明示解除は検索対象に含めない
            if (ownerId != '') { ids.add((Id)ownerId); }
        }
        // 取得を項目数に比例して増やさない
        return ids;
    }

    /**
     * 取得済み索引から同じ所有者IDだけを選択
     * @param ownerId 形式確認済みID、未設定は空文字
     * @param records IDで取得した所有者索引
     * @return 同じIDのレコード、未設定・不可視時は空リスト
     */
    public List<SObject> selectCachedOwner(String ownerId, Map<Id, SObject> records) {
        // 空値を他の所有者へ補完しない
        SObject owner = ownerId == '' ? null : records.get((Id)ownerId);
        // IDが見つからない場合は後続の検証で拒否
        return owner == null ? new List<SObject>() : new List<SObject>{owner};
    }

    /**
     * 取得済み所有者をID照合用の索引へ変換
     * @param users 可視ユーザー
     * @param groups 可視公開グループ
     * @return 同じレコードのIDをキーとする索引
     */
    public Map<Id, SObject> createOwnerIndex(List<User> users, List<Group> groups) {
        // ユーザーと公開グループを一つのID空間で照合
        Map<Id, SObject> owners = new Map<Id, SObject>(users);
        // 公開グループも実レコードのIDで統合
        owners.putAll(groups);
        // 入力リストを変更せず新しい索引を返却
        return owners;
    }

    /**
     * 指定したIDと取得レコードの対応を厳密に確認
     * @param ownerId ユーザー・公開グループID、未設定は空文字
     * @param owners IDで取得した所有者
     */
    public void validateOwnerReference(String ownerId, List<SObject> owners) {
        // 明示解除は所有者レコードが空の場合だけ許可
        if (ownerId == '') {
            // 空IDに別レコードが対応していれば拒否
            if (!owners.isEmpty()) { throw ObjectExplorerAccessPolicy.createException('未設定の所有者に候補が対応しています。更新は行いません。'); }
            // 解除対象にはAPI識別子の照合が不要
            return;
        }
        // 件数とIDの両方で対象の一意性を確認
        if (owners.size() != 1 || owners[0].Id != (Id)ownerId) { throw ObjectExplorerAccessPolicy.createException('選択した所有者を特定できません。更新は行いません。'); }
        // 同じレコードのAPI識別子が存在することを確認
        validateOwnerIdentifier(owners[0]);
    }

    /**
     * 新規の無効ユーザーを所有者に指定させない
     * @param ownerId 選択した所有者ID
     * @param owners IDで取得した所有者
     * @param currentOwnerId APIから取得した現在の所有者ID
     */
    public void validateSelectedOwner(String ownerId, List<SObject> owners, String currentOwnerId) {
        validateOwnerReference(ownerId, owners);
        if (owners.isEmpty()) { return; }
        if (owners[0] instanceof User && owners[0].get('IsActive') == false && ownerId != currentOwnerId) { throw ObjectExplorerAccessPolicy.createException('無効なユーザーを新しい所有者に指定できません。'); }
    }

    /**
     * ユーザーとグループの表示名を共通の索引へ変換
     * @param users 可視ユーザー
     * @param groups 可視公開グループ
     * @return 所有者表示名の索引
     */
    public Map<Id, String> createOwnerLabels(List<User> users, List<Group> groups) {
        Map<Id, String> labels = new Map<Id, String>();
        for (User record : users) { labels.put(record.Id, createOwnerChoice(new List<SObject>{record}).get('label')); }
        for (Group record : groups) { labels.put(record.Id, createOwnerChoice(new List<SObject>{record}).get('label')); }
        return labels;
    }

    /**
     * サーバーでID照合済みの所有者だけをMetadata API用の値へ変換
     * @param values 分類3属性と所有者ID
     * @param owners 選択IDで取得した所有者、明示解除時は空
     * @return クライアントの識別名を使用しないAPI用の分類
     */
    public Map<String, Object> createMetadataDraft(Map<String, Object> values, List<SObject> owners) {
        Map<String, Object> result = new Map<String, Object>{'complianceGroup' => values.get('complianceGroup'),
            'securityClassification' => values.get('securityClassification'), 'businessStatus' => values.get('businessStatus'),
            'businessOwnerUser' => '', 'businessOwnerGroup' => ''};
        if (!owners.isEmpty()) {
            SObject owner = owners[0];
            if (owner instanceof User) { result.put('businessOwnerUser', owner.get('Username')); }
            else { result.put('businessOwnerGroup', owner.get('DeveloperName')); }
        }
        return result;
    }

    /**
     * 同じ所有者レコードのIDと表示名を一つの候補へ変換
     * @param owners IDで取得・検証済みの所有者、未設定時は空
     * @return 分離して対応づけない所有者候補
     */
    public Map<String, String> createOwnerChoice(List<SObject> owners) {
        if (owners.isEmpty()) { return new Map<String, String>{'value' => '', 'label' => '未設定'}; }
        SObject owner = owners[0];
        String identifier = (String)owner.get(owner instanceof User ? 'Username' : 'DeveloperName');
        return new Map<String, String>{'value' => String.valueOf(owner.Id), 'label' => (String)owner.get('Name'), 'description' => identifier};
    }

    /**
     * ID照合済みの所有者にAPI参照値が存在することを確認
     * @param owner IDで一意に取得したユーザーまたは公開グループ
     */
    private void validateOwnerIdentifier(SObject owner) {
        // レコードの種類に対応する識別子だけを使用
        String identifier = (String)owner.get(owner instanceof User ? 'Username' : 'DeveloperName');
        // 表示名からの代用や未設定への変換を許可しない
        if (String.isBlank(identifier)) { throw ObjectExplorerAccessPolicy.createException('所有者のAPI識別子を確認できません。更新は行いません。'); }
    }

    /** CSVに指定された所有者IDの形式・件数と候補を確認 */
    public class CsvOwners {
        private ObjectExplorerOwnerService owners = new ObjectExplorerOwnerService();

        /**
         * CSVに明示した18桁の所有者IDだけを受け付ける
         * @param idsJson ユーザー・公開グループIDの配列JSON
         * @return 重複を除いた所有者ID、空要求は空集合
         */
        public Set<Id> parseIds(String idsJson) {
            // JSONの構文と配列形式はID照合より前に確定
            List<Object> values = new ObjectExplorerAccessPolicy().readJsonArray(idsJson, 100000, 'CSVの所有者ID要求が不正です。配列で指定してください。');
            // ブラウザのCSV上限をサーバー側でも適用
            if (values.size() > 2000) { throw ObjectExplorerAccessPolicy.createException('CSVの所有者IDは2000件以内で指定してください。'); }
            // ID以外の識別名は検索しない
            Set<Id> ids = new Set<Id>();
            // 不正な一件があれば取得全体を拒否
            for (Object value : values) {
                // 型とレコード種別を同時に確認
                if (!(value instanceof String) || !Pattern.matches('(005|00G)[A-Za-z0-9]{15}', (String)value)) { throw ObjectExplorerAccessPolicy.createException('所有者にはユーザーまたは公開グループの18桁IDを指定してください。'); }
                // SalesforceのID型で照合する集合へ統一
                ids.add((Id)(String)value);
            }
            // 検証済み条件だけをSelectorへ引き渡す
            return ids;
        }

        /**
         * 参照可能な所有者のIDと表示名を同じ候補へ保持
         * @param users 指定IDで取得したユーザー
         * @param groups 指定IDで取得した公開グループ
         * @return 18桁IDをキーとする候補、取得できないIDは含めない
         */
        public Map<String, Object> createChoices(List<User> users, List<Group> groups) {
            // API応答順からCSV行を推測しない
            Map<String, Object> result = new Map<String, Object>();
            // 無効ユーザーは新規指定できない状態として返す
            for (User record : users) {
                // 表示名とIDを同じレコードから生成
                Map<String, String> owner = this.owners.createOwnerChoice(new List<SObject>{record});
                // 表示名の一致をIDの代用にしない
                result.put(owner.get('value'), new Map<String, Object>{'value' => owner.get('value'), 'label' => owner.get('label'), 'active' => record.IsActive});
            }
            // 公開グループはSelectorの種別条件で取得済み
            for (Group record : groups) {
                // グループも同じID契約を使用
                Map<String, String> owner = this.owners.createOwnerChoice(new List<SObject>{record});
                // 未取得のIDへ候補を補完しない
                result.put(owner.get('value'), new Map<String, Object>{'value' => owner.get('value'), 'label' => owner.get('label'), 'active' => true});
            }
            // 元の取得レコードを変更しない
            return result;
        }
    }
}
