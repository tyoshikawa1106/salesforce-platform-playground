/** Describeに基づくオブジェクト・項目・直接参照の表示モデル */
public with sharing class ObjectExplorerService {

    // 候補の描画件数を検索処理と同じ上限で制御
    private static final Integer CANDIDATE_LIMIT = 2000;
    // 項目一覧には残し、関連カードだけから除外する標準監査項目
    private static final Set<String> AUDIT_FIELDS = new Set<String>{'CreatedById', 'LastModifiedById'};

    /**
     * ラベルとAPI名で参照可能な通常オブジェクトを検索
     * @param term 部分一致の検索語
     * @return API名順の先頭候補
     */
    public List<Map<String, Object>> searchObjects(String term) {
        String needle = (term ?? '').trim().toLowerCase();
        Map<String, Schema.SObjectType> types = Schema.getGlobalDescribe();
        // 主要オブジェクトの固定一覧を使わず組織の定義から候補を作成
        List<String> names = new List<String>(types.keySet());
        names.sort();
        List<Map<String, Object>> results = new List<Map<String, Object>>();
        for (String name : names) {
            Schema.DescribeSObjectResult info = types.get(name).getDescribe(SObjectDescribeOptions.DEFERRED);
            if (!isSearchMatch(info, needle)) { continue; }
            // 候補と詳細で同じオブジェクト名を表示
            results.add(new Map<String, Object>{'apiName' => info.getName(), 'label' => getObjectLabel(info)});
            if (results.size() >= CANDIDATE_LIMIT) { break; }
        }
        return results;
    }

    /**
     * 参照可否・部分一致を一つの候補条件へまとめる
     * @param info 候補オブジェクトの定義
     * @param needle 正規化した検索語
     * @return 候補に含める場合true
     */
    private Boolean isSearchMatch(Schema.DescribeSObjectResult info, String needle) {
        if (!info.isAccessible() || !info.isQueryable() || info.isCustomSetting()) { return false; }
        // 表示していない欠落メッセージでは検索に一致させない
        return info.getName().toLowerCase().contains(needle) || getObjectLabel(info).toLowerCase().contains(needle);
    }

    /**
     * オブジェクトラベルを表示・検索で共通化
     * @param info 対象オブジェクトの定義
     * @return ラベル欠落時はAPI名、それ以外は組織のラベル
     */
    private String getObjectLabel(Schema.DescribeSObjectResult info) {
        // Salesforceが返す欠落メッセージを利用者向けの名称として表示しない
        String label = info.getLabel();
        // 正常な翻訳・名称変更は維持し、欠落した名称だけAPI名で補完
        return label.startsWith('__MISSING LABEL__') ? info.getName() : label;
    }

    /**
     * 指定オブジェクトの参照可能な構造を取得
     * @param objectName 必須のオブジェクトAPI名
     * @param mode referenceは関連探索を含め、classify・fieldsは項目のみ取得。nullはreference
     * @return 詳細と直接の参照関係
     */
    public Map<String, Object> getObjectInfo(String objectName, String mode) {
        // 構造・分類・日時で同じオブジェクト参照条件を適用
        Schema.SObjectType objectType = new ObjectExplorerAccessPolicy().requireObject(objectName);
        // 項目だけの取得では子関係を遅延評価のままにする
        Schema.DescribeSObjectResult info = objectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        // 省略を含む許可済みの取得範囲だけを受け付ける
        if (!new Set<String>{null, 'reference', 'classify', 'fields'}.contains(mode)) { throw new AuraHandledException('表示モードを選択してください。'); }
        // 省略時は従来の構造表示を維持
        Boolean withRelations = mode == null || mode == 'reference';
        List<Map<String, Object>> fields = new List<Map<String, Object>>();
        List<Map<String, Object>> links = new List<Map<String, Object>>();
        for (Schema.SObjectField token : info.fields.getMap().values()) {
            Schema.DescribeFieldResult field = token.getDescribe();
            if (!field.isAccessible()) { continue; }
            // 項目一覧で使用する属性だけを返す
            fields.add(new Map<String, Object>{'apiName' => field.getName(), 'label' => field.getLabel(),
                'type' => String.valueOf(field.getType()), 'custom' => field.isCustom(), 'help' => field.getInlineHelpText()});
            // 項目だけの取得では参照先のDescribeと関連モデル生成を省略
            if (withRelations) { links.addAll(createOutgoingRelations(field)); }
        }
        // 項目だけの取得では参照元の全探索を実行しない
        if (withRelations) { links.addAll(createIncomingRelations(info)); }
        List<Map<String, Object>> relations = groupRelations(links);
        // 選択中の見出しにも候補と同じ名称を使用
        return new Map<String, Object>{'apiName' => info.getName(), 'label' => getObjectLabel(info),
            'fields' => fields, 'relations' => relations};
    }

    /**
     * 項目の可視な参照先だけを関連カードへ変換
     * @param field 可視性確認済みの項目
     * @return 参照先ごとの関連情報
     */
    private List<Map<String, Object>> createOutgoingRelations(Schema.DescribeFieldResult field) {
        // 表示しない監査項目は参照先のDescribeより前に除外
        if (AUDIT_FIELDS.contains(field.getName())) { return new List<Map<String, Object>>(); }
        // 項目の属性と独立して関係だけを集約
        List<Map<String, Object>> relations = new List<Map<String, Object>>();
        // 多態参照の相手も可視性を一つずつ確認
        for (Schema.SObjectType target : field.getReferenceTo()) {
            // 相手の子関係を取得せず参照可否だけを確認
            Schema.DescribeSObjectResult parent = target.getDescribe(SObjectDescribeOptions.DEFERRED);
            // 不可視なオブジェクトをカードへ含めない
            if (!parent.isAccessible()) { continue; }
            // 関係の型・項目名と相手を一つの情報へ対応付け
            Map<String, Object> relation = createRelation(parent, field, 'OUT');
            // 元の項目定義の順序で関連を保持
            relations.add(relation);
        }
        // 表示しない参照先名の配列や属性の中間Mapを作らない
        return relations;
    }

    /**
     * 個人取引先の間接関係を除き、起点を直接参照する項目だけ抽出
     * @param info 起点の定義
     * @return 直接参照する側の関連一覧
     */
    private List<Map<String, Object>> createIncomingRelations(Schema.DescribeSObjectResult info) {
        List<Map<String, Object>> relations = new List<Map<String, Object>>();
        // 一つの関係の検証と一覧の集約を分離
        for (Schema.ChildRelationship child : info.getChildRelationships()) {
            // 間接関係や不可視な項目は空リストとして除外
            relations.addAll(createIncomingRelation(child, info.getSObjectType()));
        }
        return relations;
    }

    /**
     * 一つの子関係が直接かつ参照可能な場合だけ表示へ変換
     * @param child Describeが返した子関係
     * @param origin 起点のオブジェクト型
     * @return 可視な直接関係、対象外は空リスト
     */
    private List<Map<String, Object>> createIncomingRelation(Schema.ChildRelationship child, Schema.SObjectType origin) {
        // 項目が公開されていない関係を採用しない
        if (child.getField() == null) { return new List<Map<String, Object>>(); }
        // 監査項目は相手のDescribeや参照先一覧を取得する前に除外
        Schema.DescribeFieldResult field = child.getField().getDescribe();
        // 所有者や業務用のユーザー参照はこの除外に含めない
        if (AUDIT_FIELDS.contains(field.getName())) { return new List<Map<String, Object>>(); }
        // レコード取得なしでオブジェクトの参照可否を確認
        Schema.DescribeSObjectResult related = child.getChildSObject().getDescribe(SObjectDescribeOptions.DEFERRED);
        // 不可視な相手を表示しない
        if (!related.isAccessible()) { return new List<Map<String, Object>>(); }
        // 個人取引先などの間接関係を除外
        if (!field.isAccessible() || !field.getReferenceTo().contains(origin)) { return new List<Map<String, Object>>(); }
        // 確認済みの直接関係だけをカード用の行へ変換
        return new List<Map<String, Object>>{createRelation(related, field, 'IN')};
    }

    /**
     * 関連先・方向・項目の情報を集約前の行として生成
     * @param related 可視な相手オブジェクト
     * @param field 関連項目
     * @param direction 起点に対する参照方向
     * @return 一項目から生成した関連情報
     */
    private Map<String, Object> createRelation(Schema.DescribeSObjectResult related, Schema.DescribeFieldResult field, String direction) {
        Map<String, Object> link = new Map<String, Object>{'field' => field.getName(), 'label' => field.getLabel(),
            'polymorphic' => field.getReferenceTo().size() > 1,
            'kind' => field.getRelationshipOrder() == null ? '参照関係' : '主従関係'};
        // 関連カードも候補・見出しと同じ名称へ統一
        return new Map<String, Object>{'key' => direction + ':' + related.getName(), 'apiName' => related.getName(),
            'label' => getObjectLabel(related), 'direction' => direction, 'links' => new List<Object>{link}};
    }

    /**
     * 相手と方向が同じ関係を一枚のカードへ集約
     * @param source 可視性を確認した関連一覧
     * @return 相手と方向ごとの関連一覧
     */
    private List<Map<String, Object>> groupRelations(List<Map<String, Object>> source) {
        Map<String, Map<String, Object>> grouped = new Map<String, Map<String, Object>>();
        Map<String, Set<String>> fields = new Map<String, Set<String>>();
        for (Map<String, Object> row : source) {
            String key = (String)row.get('key');
            if (!grouped.containsKey(key)) {
                Map<String, Object> relation = new Map<String, Object>(row);
                relation.put('links', new List<Object>());
                grouped.put(key, relation);
                fields.put(key, new Set<String>());
            }
            Map<String, Object> link = (Map<String, Object>)((List<Object>)row.get('links'))[0];
            String fieldName = (String)link.get('field');
            if (fields.get(key).contains(fieldName)) { continue; }
            fields.get(key).add(fieldName);
            ((List<Object>)grouped.get(key).get('links')).add(link);
        }
        return grouped.values();
    }

}