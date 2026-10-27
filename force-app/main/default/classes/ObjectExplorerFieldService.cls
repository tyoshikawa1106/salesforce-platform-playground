/** 項目定義の型・分類・作成更新情報の可視表示モデル */
public with sharing class ObjectExplorerFieldService {
    /**
     * 可視なカスタム項目の正確なIDとAPI名を対応付け
     * @param info 参照可否確認済みのオブジェクト定義
     * @param definitions ネイティブ項目定義
     * @return 項目IDごとのAPI名
     */
    public Map<Id, String> createAuditTargets(Schema.DescribeSObjectResult info, List<FieldDefinition> definitions) {
        // Controllerが参照可否を確認した同じ定義の項目Mapを使用
        Map<String, Schema.SObjectField> fields = info.fields.getMap();
        // 項目IDと正式API名の対応だけを保持
        Map<Id, String> targets = new Map<Id, String>();
        // ネイティブ定義をDescribeと照合
        for (FieldDefinition definition : definitions) {
            // 同名の実在する項目だけを対象にする
            Schema.DescribeFieldResult field = fields.get(definition.QualifiedApiName)?.getDescribe();
            // 参照可能なカスタム項目だけを採用
            if (field?.isAccessible() != true || !field.isCustom()) { continue; }
            // 完全識別子から項目ID部分だけを取得
            String fieldId = definition.DurableId?.substringAfter('.');
            // カスタム項目のID形式以外を採用しない
            if (!Pattern.matches('00N[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?', fieldId ?? '')) { continue; }
            // 表示名を推測せず正式API名へ結び付ける
            targets.put((Id)fieldId, field.getName());
        }
        // 呼出元でHTTP取得対象を確定
        return targets;
    }

    /**
     * 取得済みの同じ項目IDへ日時と実行者を合成
     * @param targets 可視項目IDとAPI名
     * @param records 同じ組織のTooling API応答
     * @param users 実行ユーザーが参照できる作成者・更新者
     * @return API名ごとの作成・更新表示値
     */
    public Map<String, Object> createAuditView(Map<Id, String> targets, List<Map<String, Object>> records, List<User> users) {
        // 同じ項目へ対応した表示情報を保持
        Map<String, Object> result = new Map<String, Object>();
        // 人物名は可視な同じIDのUserレコードだけから取得
        Map<Id, User> visibleUsers = new Map<Id, User>(users);
        // 応答順に依存せずIDで照合
        for (Map<String, Object> record : records) {
            // 検証済み項目IDからAPI名を解決
            String apiName = targets.get((Id)String.valueOf(record.get('Id')));
            // 別項目と重複した応答を拒否
            if (apiName == null || result.containsKey(apiName)) { throw new AuraHandledException('項目の作成・更新情報の対応を確認できませんでした。'); }
            // 更新者・作成者を名前ではなく応答のIDで照合
            User creator = visibleUsers.get((Id)(String)record.get('CreatedById'));
            // 閲覧できないUserのIDや名前を公開しない
            User modifier = visibleUsers.get((Id)(String)record.get('LastModifiedById'));
            // 日時と可視なユーザーを同じ対象へ合成
            result.put(apiName, new Map<String, Object>{'createdDate' => record.get('CreatedDate'),
                'createdById' => creator?.Id,
                'createdByName' => creator?.Name,
                'lastModifiedDate' => record.get('LastModifiedDate'),
                'lastModifiedById' => modifier?.Id,
                'lastModifiedByName' => modifier?.Name});
        }
        // 未取得の項目を未設定として扱わない
        if (result.size() != targets.size()) { throw new AuraHandledException('項目の作成・更新情報をすべて取得できませんでした。'); }
        // 全件を照合した表示値だけを返却
        return result;
    }
    /**
     * 実行ユーザーの参照可否を確認して作成者・更新者のIDを集約
     * @param records 項目定義の日時とユーザーID
     * @return 照会できるユーザーID、User参照不可は空集合
     */
    public Set<Id> collectAuditUserIds(List<Map<String, Object>> records) {
        // Userの参照権限・名前のFLSがなければ人物照会を行わない
        if (!Schema.User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible() || !Schema.User.Name.getDescribe().isAccessible()) { return new Set<Id>(); }
        // 項目数にかかわらず人物IDを重複排除
        Set<Id> ids = new Set<Id>();
        // 作成者・更新者は同じ項目応答のIDだけを使用
        for (Map<String, Object> record : records) {
            // 名前からの逆引きをしない
            ids.add((Id)(String)record.get('CreatedById'));
            // 更新者も同じネイティブIDで扱う
            ids.add((Id)(String)record.get('LastModifiedById'));
        }
        // 未取得を全ユーザー検索へ補完しない
        ids.remove(null);
        // 可視性を確認した後の照会条件だけを返却
        return ids;
    }

    /**
     * 確認済みの項目IDをTooling API用に200件ずつ分割
     * @param ids ネイティブ定義の項目ID
     * @return 200件以下のID集合の一覧
     */
    public List<Set<Id>> createAuditBatches(Set<Id> ids) {
        // 一要求200件以下の対象を保持
        List<Set<Id>> batches = new List<Set<Id>>();
        // 型付きIDを照会単位へ分割
        for (Id fieldId : ids) {
            // カスタム項目以外のIDを拒否
            if (!String.valueOf(fieldId).startsWith('00N')) { throw new AuraHandledException('カスタム項目の識別子を確認してください。'); }
            // 200件に達した場合だけ次の要求を作成
            if (batches.isEmpty() || batches[batches.size() - 1].size() == 200) { batches.add(new Set<Id>()); }
            // 同じIDを一回だけ要求
            batches[batches.size() - 1].add(fieldId);
        }
        // 確認済みの分割対象を呼出元へ返却
        return batches;
    }
    /**
     * 確認済みのIDを日時取得用の固定クエリへ変換
     * @param fieldIds 分割と識別子を確認済みの項目ID
     * @return Tooling API用のクエリ文字列
     */
    public String createAuditQuery(Set<Id> fieldIds) {
        // 型付きIDだけを照会条件へ使用
        List<String> ids = new List<String>();
        // 表示名やAPI名の推測をクエリへ含めない
        for (Id fieldId : fieldIds) { ids.add('\'' + String.valueOf(fieldId) + '\''); }
        // 認証値やMetadata本文を取得せず日時とユーザー名だけを要求
        return 'SELECT Id, CreatedDate, CreatedById, LastModifiedDate, LastModifiedById FROM CustomField WHERE Id IN (' + String.join(ids, ',') + ')';
    }

    /**
     * 日時情報の完了した応答だけをレコードへ変換
     * @param response Tooling APIの日時クエリ応答
     * @return 項目IDを維持した日時・実行者レコード
     */
    public List<Map<String, Object>> readAuditRecords(Map<String, Object> response) {
        // 未完了の一部応答を全件取得として扱わない
        if (response.get('done') != true || !(response.get('records') instanceof List<Object>)) { throw new AuraHandledException('項目の作成・更新情報をすべて取得できませんでした。'); }
        // 後で要求ID・重複・欠落を確認できる形で保持
        List<Map<String, Object>> records = new List<Map<String, Object>>();
        // レコードの識別子を保ったまま型を統一
        for (Object value : (List<Object>)response.get('records')) { records.add((Map<String, Object>)value); }
        // 表示値への加工は全件照合の後に行う
        return records;
    }
    /**
     * 項目定義の型表記を可視項目へ合成
     * @param data Describeで参照可否を確認した表示モデル
     * @param particles 対象オブジェクトの構成項目と型表記
     * @return 元のAPI型を維持した表示モデル
     */
    public Map<String, Object> createFieldTypeView(Map<String, Object> data, List<EntityParticle> particles) {
        // 型ラベルはネイティブ項目API名へだけ対応付ける
        Map<String, String> labels = new Map<String, String>();
        // 個人取引先・構成項目の表示名を同じ取得結果から合成
        for (EntityParticle particle : particles) {
            // 同じ項目の型表記を登録
            labels.put(particle.QualifiedApiName, particle.FieldDefinition.DataType);
        }
        // 呼出元の項目一覧は変更しない
        List<Map<String, Object>> fields = new List<Map<String, Object>>();
        // 可視と確認済みの項目だけへ型を設定
        for (Map<String, Object> field : (List<Map<String, Object>>)data.get('fields')) {
            // 同じAPI名の属性を複製
            Map<String, Object> row = new Map<String, Object>(field);
            // 参照元と型ラベルのキーを一致させる
            String label = labels.get((String)field.get('apiName'));
            // 未取得の型を別の種類へ推測しない
            row.put('typeLabel', String.isBlank(label) ? '型情報を取得できません' : label);
            // 表示用の行だけを返却対象へ追加
            fields.add(row);
        }
        // 関係情報を保持した新しい表示モデルを作成
        Map<String, Object> result = new Map<String, Object>(data);
        // 型を合成した行へ置き換え
        result.put('fields', fields);
        // 入力を変更せず表示モデルを返却
        return result;
    }
    /**
     * 可視項目の分類をAPI名で索引化
     * @param records 項目の分類レコード
     * @param objectType 可視性確認済み対象
     * @param ownerLabels 所有者IDに対応する可視表示名
     * @return 一覧の分類と編集可否
     */
    public Map<String, Object> createRows(List<FieldDefinition> records, Schema.SObjectType objectType, Map<Id, String> ownerLabels) {
        // 未設定の表示を一度だけ定義し、入力の所有者Mapは変更しない
        Map<Id, String> displayLabels = new Map<Id, String>(ownerLabels);
        // 未設定のIDと参照できない既存IDを区別
        displayLabels.put(null, '未設定');
        // 分類一覧でも全項目で同じオブジェクト定義を共用
        Schema.DescribeSObjectResult info = objectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        // 同じ対象の可視項目だけを一覧へ投影
        Map<String, Schema.SObjectField> fields = info.fields.getMap();
        // 可視な項目の正式API名をキーとして保持
        Map<String, Object> rows = new Map<String, Object>();
        // 分類レコードと同じDescribeを照合
        for (FieldDefinition record : records) {
            // 参照できる項目のDescribeだけを一回取得
            Schema.DescribeFieldResult field = fields.get(record.QualifiedApiName)?.getDescribe();
            // 存在しない項目も不可視項目と同じ条件で除外
            if (field?.isAccessible() != true) { continue; }
            // 参照可否と編集対象の判定を区別
            Boolean editable = ObjectExplorerAccessPolicy.isEditable(info, field);
            // 同じ項目の分類・所有者・編集状態をまとめる
            rows.put(field.getName(), new Map<String, Object>{'complianceGroup' => record.ComplianceGroup,
                'securityClassification' => record.SecurityClassification, 'businessStatus' => record.BusinessStatus,
                'ownerId' => (String)record.BusinessOwnerId ?? '',
                'ownerLabel' => displayLabels.get(record.BusinessOwnerId) ?? '参照できない所有者',
                'editable' => editable, 'reason' => editable ? '' : 'この種類の項目は分類編集の対象外です。'});
        }
        // 検証済みの分類一覧だけを公開
        return rows;
    }

    /**
     * 所有者の取得を項目単位のクエリへ分割しないためIDを集約
     * @param records 対象項目の分類
     * @return 所有者IDの集合
     */
    public Set<Id> collectOwnerIds(List<FieldDefinition> records) {
        // 所有者の重複を要求単位で排除
        Set<Id> ids = new Set<Id>();
        // 未設定を含めて重複排除してからnullだけを除外
        for (FieldDefinition record : records) { ids.add(record.BusinessOwnerId); }
        // 所有者照会には有効なIDだけを渡す
        ids.remove(null);
        // 全行の所有者を一括で照会する条件を返却
        return ids;
    }
}
