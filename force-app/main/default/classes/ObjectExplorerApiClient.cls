/** オブジェクト探索の項目照会と分類更新に限定したSalesforce API操作 */
public with sharing class ObjectExplorerApiClient {
    private SalesforceApiClient client = new SalesforceApiClient();
    private Map<String, Dom.XmlNode> customDefinitions = new Map<String, Dom.XmlNode>();

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
     * カスタム項目の最新定義と分類を一括取得
     * @param fullNames FieldDefinitionで確認した完全名、1～10件
     * @return 完全名をキーとする分類応答
     */
    public Map<String, Map<String, Object>> readCustomFields(Set<String> fullNames) {
        // 失敗した読取の前に保持していた定義を再利用しない
        this.customDefinitions.clear();
        ObjectExplorerApiProtocol.CustomFieldCodec codec = new ObjectExplorerApiProtocol.CustomFieldCodec();
        HttpResponse response = this.client.sendMetadataUpdate(codec.createReadRequest(fullNames));
        this.customDefinitions = codec.readCustomDefinitions(response, fullNames);
        Map<String, Map<String, Object>> records = new Map<String, Map<String, Object>>();
        for (String fullName : this.customDefinitions.keySet()) {
            Map<String, Object> metadata = new Map<String, Object>();
            for (String key : new List<String>{'businessOwnerUser', 'businessOwnerGroup', 'businessStatus', 'complianceGroup', 'securityClassification'}) {
                metadata.put(key, this.customDefinitions.get(fullName).getChildElement(key, 'http://soap.sforce.com/2006/04/metadata')?.getText());
            }
            records.put(fullName, new Map<String, Object>{'FullName' => fullName, 'Metadata' => metadata});
        }
        return records;
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
     * 標準・カスタム項目の分類を同じ要求で一括更新
     * @param fields 完全名をキーとする検証済み分類属性、1～10件
     * @param customNames 同じ要求に含むカスタム項目の完全名
     * @return 完全名別の成功または安全な拒否理由
     */
    public Map<String, String> updateFields(Map<String, Map<String, Object>> fields, Set<String> customNames) {
        if (!fields.keySet().containsAll(customNames)) { throw new SalesforceApiClient.IntegrationException('更新する項目定義が一致しません。'); }
        Map<String, Dom.XmlNode> definitions = new Map<String, Dom.XmlNode>();
        for (String fullName : customNames) { definitions.put(fullName, this.customDefinitions.remove(fullName)); }
        MetadataApiSoapCodec codec = new MetadataApiSoapCodec();
        String body = new ObjectExplorerApiProtocol.CustomFieldCodec().createUpdateRequest(fields, definitions);
        HttpResponse response = this.client.sendMetadataUpdate(body);
        if (new Set<Integer>{401, 403, 429}.contains(response.getStatusCode())) { throw new SalesforceApiClient.RejectedUpdateException(SalesforceApiProtocol.httpMessage(response)); }
        return codec.readUpdateResults(response, fields.keySet());
    }
}