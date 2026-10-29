/** Metadata SOAPのXML生成・応答形式・項目の完全名を検証 */
public with sharing class MetadataApiSoapCodec {

    private static final String SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
    private static final String METADATA_NS = 'http://soap.sforce.com/2006/04/metadata';
    private static final String XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

    /**
     * 標準項目の分類だけを含む一括更新のSOAP本文を生成
     * @param fields 検証済み完全名と分類5属性の対応
     * @return 認証差し込み箇所を限定したSOAP本文
     */
    public String createUpdateRequest(Map<String, Map<String, Object>> fields) {
        if (fields.isEmpty() || fields.size() > 10) { throw new MetadataApiIntegrationClient.IntegrationException('標準項目の一括更新は1～10件で指定してください。'); }
        Dom.Document doc = new Dom.Document();
        Dom.XmlNode envelope = doc.createRootElement('Envelope', SOAP_NS, 'env');
        envelope.setAttribute('xmlns:xsi', XSI_NS);
        Dom.XmlNode header = envelope.addChildElement('Header', SOAP_NS, 'env');
        Dom.XmlNode session = header.addChildElement('SessionHeader', METADATA_NS, 'met');
        session.addChildElement('sessionId', METADATA_NS, 'met').addTextNode('{!$Credential.OAuthToken}');
        Dom.XmlNode soapBody = envelope.addChildElement('Body', SOAP_NS, 'env');
        Dom.XmlNode operation = soapBody.addChildElement('updateMetadata', METADATA_NS, 'met');
        for (String fullName : fields.keySet()) {
            // 同じ項目の完全名と属性を一つの単位でXMLへ追加
            appendMetadataField(operation, fullName, fields.get(fullName));
        }
        // 認証欄以外の値をNamed Credentialの差し込み式にしない
        String xml = doc.toXmlString().replace('{', '&#123;');
        String body = xml.replace('<met:sessionId>&#123;!$Credential.OAuthToken}</met:sessionId>', '<met:sessionId>{!$Credential.OAuthToken}</met:sessionId>');
        // 認証欄以外をエスケープした本文だけを通信層へ返却
        return body;
    }

    /**
     * 同じ項目の分類属性だけをSOAP要求へ追加
     * @param operation 更新操作のXML要素
     * @param fullName 検証対象の完全名
     * @param metadata 同じ項目の分類定義
     */
    private void appendMetadataField(Dom.XmlNode operation, String fullName, Map<String, Object> metadata) {
        // 完全名へパスやSOQL断片を含めさせない
        if (!Pattern.matches('[A-Za-z0-9_]+\\.[A-Za-z0-9_]+', fullName ?? '')) { throw new MetadataApiIntegrationClient.IntegrationException('項目識別子が不正です。'); }
        // 完全名と定義の対応を送信直前にも確認
        if (metadata.get('fullName') != fullName) { throw new MetadataApiIntegrationClient.IntegrationException('分類を更新する項目の識別名が一致しません。'); }
        // 文字列の連結ではなくXML APIで値を追加
        Dom.XmlNode field = operation.addChildElement('metadata', METADATA_NS, 'met');
        // 更新するメタデータ型を固定
        field.setAttribute('xsi:type', 'met:CustomField');
        // 対象の完全名を同じ要素に保持
        field.addChildElement('fullName', METADATA_NS, 'met').addTextNode(fullName);
        // 分類以外の標準項目定義を送信しない
        for (String key : new List<String>{'businessOwnerGroup', 'businessOwnerUser', 'businessStatus', 'complianceGroup', 'securityClassification'}) {
            // 明示解除は空のXML要素として送信
            field.addChildElement(key, METADATA_NS, 'met').addTextNode((String)metadata.get(key) ?? '');
        }
    }

    /**
     * 応答順に依存せず完全名で一括更新結果を照合
     * @param response SOAP応答
     * @param expectedNames 検証済みの更新対象
     * @return 完全名別の成功または安全な拒否理由
     */
    public Map<String, String> readUpdateResults(HttpResponse response, Set<String> expectedNames) {
        Dom.XmlNode operation = readUpdateOperation(response);
        Map<String, String> results = new Map<String, String>();
        for (Dom.XmlNode result : operation.getChildElements()) {
            String fullName = result.getChildElement('fullName', METADATA_NS)?.getText();
            if (!expectedNames.contains(fullName) || results.containsKey(fullName)) { throw new MetadataApiIntegrationClient.IntegrationException('Metadata APIの更新結果の対象項目が一致しません。'); }
            results.put(fullName, readUpdateStatus(result));
        }
        if (results.keySet() != expectedNames) { throw new MetadataApiIntegrationClient.IntegrationException('Metadata APIの更新結果に不足があります。最新状態を再取得してください。'); }
        return results;
    }

    /**
     * 成否が明示された一件だけを採用
     * @param result 対象名を照合済みの更新結果
     * @return 成功は空文字、拒否は案内
     */
    private String readUpdateStatus(Dom.XmlNode result) {
        String success = result.getChildElement('success', METADATA_NS)?.getText();
        // 成功・明示拒否・形式不明を混同しない
        switch on success {
            when 'true' { return ''; }
            when 'false' { return readUpdateError(result); }
            when else { throw new MetadataApiIntegrationClient.IntegrationException('Metadata APIの更新成否を確認できませんでした。'); }
        }
    }

    /**
     * SOAP構文・Fault・HTTP結果を検証して更新結果の境界を取得
     * @param response SOAP応答
     * @return 更新結果を含む操作要素
     */
    private Dom.XmlNode readUpdateOperation(HttpResponse response) {
        Dom.XmlNode body;
        try {
            Dom.Document doc = new Dom.Document(); doc.load(response.getBody());
            body = doc.getRootElement().getChildElement('Body', SOAP_NS);
        } catch (Exception error) { throw new MetadataApiIntegrationClient.IntegrationException('Metadata APIの応答形式を確認できませんでした。最新状態を再取得してください。'); }
        if (body?.getChildElement('Fault', SOAP_NS) != null) { throw new MetadataApiIntegrationClient.RejectedUpdateException('Metadata APIが更新要求を拒否しました。認証・権限・入力値を確認してください。'); }
        Dom.XmlNode operation = body?.getChildElement('updateMetadataResponse', METADATA_NS);
        if (response.getStatusCode() != 200 || operation == null) { throw new MetadataApiIntegrationClient.IntegrationException('Metadata APIの更新応答を確認できませんでした。最新状態を再取得してください。'); }
        return operation;
    }

    /**
     * APIの拒否理由を認証情報を含まない固定形式へ変換
     * @param result 同じ項目と照合済みの失敗結果
     * @return 検証済みエラーコードだけを含む案内
     */
    private String readUpdateError(Dom.XmlNode result) {
        String code = result.getChildElement('errors', METADATA_NS)?.getChildElement('statusCode', METADATA_NS)?.getText();
        String safeCode = Pattern.matches('[A-Z_]+', code ?? '') ? code : 'UNKNOWN_ERROR';
        return 'Metadata APIが更新を拒否しました（' + safeCode + '）。設定値・権限を確認してください。';
    }
}