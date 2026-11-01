/** オブジェクト探索の項目照会と分類更新に限定したSalesforce API操作 */
public with sharing class ObjectExplorerApiClient {
    private SalesforceApiClient client = new SalesforceApiClient();

    /**
     * 可視なカスタム項目の作成・更新情報だけをTooling APIで取得
     * @param fieldIds 同じ組織で確認した項目ID、1～200件
     * @return 対応付け前のクエリ応答
     */
    public Map<String, Object> readFieldAudit(Set<Id> fieldIds) {
        if (fieldIds == null || fieldIds.isEmpty() || fieldIds.size() > 200) { throw new SalesforceApiClient.IntegrationException('項目情報の取得は1～200件で指定してください。'); }
        for (Id fieldId : fieldIds) {
            if (!String.valueOf(fieldId).startsWith('00N')) { throw new SalesforceApiClient.IntegrationException('カスタム項目のIDが不正です。'); }
        }
        String query = new ObjectExplorerFieldService().createAuditQuery(fieldIds);
        return this.client.request('tooling/query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'), 'GET', null);
    }

    /**
     * カスタム項目の最新定義を読み取り
     * @param durableId FieldDefinitionで確認した完全な識別子
     * @return 完全名と最新定義を含む応答
     */
    public Map<String, Object> readCustomField(String durableId) {
        // 対象IDを検証した固定パスだけを読み取り
        String path = customFieldPath(durableId);
        // 分類以外も保持するため最新定義を取得
        return this.client.request(path, 'GET', null);
    }

    /**
     * 分類以外の設定済み定義を保持してカスタム項目を更新
     * @param durableId 取得済みの完全な識別子
     * @param metadata 最新定義の分類だけを変更した値
     */
    public void updateCustomField(String durableId, Map<String, Object> metadata) {
        // カスタム項目以外のパスへ更新しない
        String path = customFieldPath(durableId);
        // 未設定の複合属性だけを除いて取得済みの値を保持
        Map<String, Object> payload = (Map<String, Object>)ObjectExplorerApiProtocol.cleanMetadata(metadata);
        // 解除対象の分類属性は明示的なnullを維持
        for (String key : new List<String>{'businessOwnerUser', 'businessOwnerGroup', 'businessStatus', 'complianceGroup', 'securityClassification'}) { payload.put(key, metadata.get(key)); }
        // 検証済みの同じ項目へ定義を反映
        this.client.request(path, 'PATCH', JSON.serialize(new Map<String, Object>{'Metadata' => payload}));
    }

    /**
     * 分類3属性とネイティブ所有者IDを同じ要求で一括取得
     * @param objectName 検証済みオブジェクト名
     * @param fieldNames 検証済み項目名、最大10件
     * @return 項目API名で一意に照合した応答
     */
    public Map<String, Map<String, Object>> readClassifyData(String objectName, Set<String> fieldNames) {
        if (fieldNames.isEmpty() || fieldNames.size() > 10) { throw new SalesforceApiClient.IntegrationException('分類の取得は1～10項目で指定してください。'); }
        List<String> names = new List<String>();
        for (String name : fieldNames) { requireFullName(objectName + '.' + name); names.add('\'' + name + '\''); }
        String query = 'SELECT DurableId, QualifiedApiName, ComplianceGroup, SecurityClassification, BusinessStatus, BusinessOwnerId FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = \''
            + String.escapeSingleQuotes(objectName) + '\' AND QualifiedApiName IN (' + String.join(names, ',') + ')';
        Map<String, Object> response = this.client.request('query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'), 'GET', null);
        // 件数・属性・項目名の照合を通信処理から分離
        return new ObjectExplorerApiProtocol.RecordReader().readClassifyData(response, fieldNames);
    }

    /**
     * 完全名へAPIパスやSOQLの断片を含めさせない
     * @param fullName オブジェクト名と項目名
     */
    private static void requireFullName(String fullName) {
        // 項目名に使用できる識別子だけを許可
        if (!Pattern.matches('[A-Za-z0-9_]+\\.[A-Za-z0-9_]+', fullName ?? '')) { throw new SalesforceApiClient.IntegrationException('項目識別子が不正です。'); }
    }

    /**
     * カスタム項目のIDだけをTooling APIの対象へ変換
     * @param durableId FieldDefinitionで取得した完全な識別子
     * @return カスタム項目だけを許可した固定パス
     */
    private String customFieldPath(String durableId) {
        // 元のオブジェクト識別子も含めて検証
        requireFullName(durableId);
        // 完全な識別子から取得済みの項目IDを分離
        String fieldId = durableId.substringAfter('.');
        // 項目API名や別オブジェクトIDを更新先に使用しない
        if (!Pattern.matches('00N[A-Za-z0-9]{12}([A-Za-z0-9]{3})?', fieldId)) { throw new SalesforceApiClient.IntegrationException('カスタム項目のIDが不正です。'); }
        // 検証済みIDだけでカスタム項目のパスを固定
        return 'tooling/sobjects/CustomField/' + fieldId;
    }

    /**
     * 標準項目の分類だけを一括更新し、同じ完全名で成否を確認
     * @param fields 完全名をキーとする分類属性だけの定義
     * @return 完全名別の成功または安全な拒否理由
     */
    public Map<String, String> updateStandardFields(Map<String, Map<String, Object>> fields) {
        // XMLの生成と応答検証を同じプロトコル契約へ集約
        MetadataApiSoapCodec protocol = new MetadataApiSoapCodec();
        // 本文の認証差し込み箇所以外は文字列としてエスケープ
        String body = protocol.createUpdateRequest(fields);
        // HTTP認証・待ち時間・接続エラーは既存の通信経路を使用
        HttpResponse response = this.client.sendMetadataUpdate(body);
        // 認証とアクセス拒否はSOAP解析より前に共通形式で通知する
        if (new Set<Integer>{401, 403, 429}.contains(response.getStatusCode())) { throw new SalesforceApiClient.RejectedUpdateException(SalesforceApiProtocol.httpMessage(response)); }
        // 応答順に依存せず同じ完全名へ照合
        return protocol.readUpdateResults(response, fields.keySet());
    }
}