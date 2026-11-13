/** Metadata SOAPのXML生成・応答形式・項目の完全名を検証 */
public with sharing class MetadataApiSoapCodec {

    private static final String SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
    private static final String METADATA_NS = 'http://soap.sforce.com/2006/04/metadata';
    private static final String XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';

    /**
     * 認証ヘッダーと操作名を固定したSOAP文書を生成
     * @param operationName 内部で固定した操作名
     * @return 認証ヘッダーを持つ文書
     */
    public Dom.Document createRequestDocument(String operationName) {
        Dom.Document doc = new Dom.Document();
        Dom.XmlNode envelope = doc.createRootElement('Envelope', SOAP_NS, 'env');
        envelope.setAttribute('xmlns:xsi', XSI_NS);
        Dom.XmlNode header = envelope.addChildElement('Header', SOAP_NS, 'env');
        Dom.XmlNode session = header.addChildElement('SessionHeader', METADATA_NS, 'met');
        session.addChildElement('sessionId', METADATA_NS, 'met').addTextNode('{!$Credential.OAuthToken}');
        envelope.addChildElement('Body', SOAP_NS, 'env').addChildElement(operationName, METADATA_NS, 'met');
        return doc;
    }

    /**
     * 認証欄以外の差し込み式を無効化
     * @param doc 認証欄を固定した文書
     * @return 認証欄だけに差し込みを許可したXML
     */
    public String serializeRequest(Dom.Document doc) {
        String xml = doc.toXmlString().replace('{', '&#123;');
        return xml.replace('<met:sessionId>&#123;!$Credential.OAuthToken}</met:sessionId>', '<met:sessionId>{!$Credential.OAuthToken}</met:sessionId>');
    }

    /**
     * APIの対象を項目完全名だけに限定
     * @param fullName オブジェクトと項目の正式名
     */
    public void requireFullName(String fullName) {
        if (String.isBlank(fullName) || !Pattern.matches('[A-Za-z0-9_]+\\.[A-Za-z0-9_]+', fullName)) { throw new SalesforceApiClient.IntegrationException('項目識別子が不正です。'); }
    }

    /**
     * 同じ項目の分類属性だけをSOAP要求へ追加
     * @param operation 更新操作のXML要素
     * @param fullName 検証対象の完全名
     * @param metadata 同じ項目の分類定義
     */
    public void appendMetadataField(Dom.XmlNode operation, String fullName, Map<String, Object> metadata) {
        // 完全名へパスやSOQL断片を含めさせない
        requireFullName(fullName);
        // 完全名と定義の対応を送信直前にも確認
        requireUpdateTarget(operation, metadata);
        if (metadata.get('fullName') != fullName) { throw new SalesforceApiClient.IntegrationException('分類を更新する項目の識別名が一致しません。'); }
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
        Dom.XmlNode operation = readOperation(response, 'updateMetadataResponse', '[OE-SAVE-UNCONFIRMED] Metadata APIの更新結果を確認できませんでした。最新状態を再取得してください。');
        Map<String, String> results = new Map<String, String>();
        for (Dom.XmlNode result : operation.getChildElements()) {
            String fullName = result.getChildElement('fullName', METADATA_NS)?.getText();
            if (!expectedNames.contains(fullName) || results.containsKey(fullName)) { throw new SalesforceApiClient.IntegrationException('Metadata APIの更新結果の対象項目が一致しません。'); }
            results.put(fullName, readUpdateStatus(result));
        }
        if (results.keySet() != expectedNames) { throw new SalesforceApiClient.IntegrationException('Metadata APIの更新結果に不足があります。最新状態を再取得してください。'); }
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
            when 'false' { return SalesforceApiProtocol.metadataUpdateError(result); }
            when else { throw new SalesforceApiClient.IntegrationException('Metadata APIの更新成否を確認できませんでした。'); }
        }
    }

    /**
     * SOAP構文・Fault・HTTP結果を検証して更新結果の境界を取得
     * @param response SOAP応答
     * @param operationName 要求した操作の応答名
     * @param failureMessage 呼び出し段階に対応する固定案内
     * @return 対象操作の応答要素
     */
    public Dom.XmlNode readOperation(HttpResponse response, String operationName, String failureMessage) {
        Dom.XmlNode body = readBody(response);
        if (body?.getChildElement('Fault', SOAP_NS) != null) { throw new SalesforceApiClient.IntegrationException(failureMessage); }
        Dom.XmlNode operation = body?.getChildElement(operationName, METADATA_NS);
        if (response.getStatusCode() != 200 || operation == null) { throw new SalesforceApiClient.IntegrationException(failureMessage); }
        return operation;
    }

    /** XML生成で必須の操作要素と定義を確認
     * @param operation 更新先の操作要素
     * @param metadata 変更対象の定義
     */
    public void requireUpdateTarget(Dom.XmlNode operation, Map<String, Object> metadata) {
        if (operation == null || metadata == null) { throw new SalesforceApiClient.IntegrationException('更新する項目定義の識別名を確認できません。'); }
    }

    /** 空応答を解析前に拒否し、SOAP本文を取得
     * @param response 外部API応答
     * @return 本文要素、未存在ならnullを呼び出し元で拒否
     */
    private Dom.XmlNode readBody(HttpResponse response) {
        if (String.isBlank(response?.getBody())) { throw new SalesforceApiClient.IntegrationException('Metadata APIの応答形式を確認できませんでした。最新状態を再取得してください。'); }
        try {
            Dom.Document doc = new Dom.Document();
            doc.load(response.getBody());
            return doc.getRootElement().getChildElement('Body', SOAP_NS);
        } catch (Exception e) { throw new SalesforceApiClient.IntegrationException('Metadata APIの応答形式を確認できませんでした。最新状態を再取得してください。'); }
    }

    /**
     * 分類以外の複合定義を型変換せずXMLとして複製
     * @param source 取得した要素
     * @param parent 複製先の親要素
     */
    public void copyDefinitionElement(Dom.XmlNode source, Dom.XmlNode parent) {
        Dom.XmlNode target = parent.addChildElement(source.getName(), source.getNamespace(), null);
        for (Integer i = 0; i < source.getAttributeCount(); i++) {
            String key = source.getAttributeKeyAt(i);
            String ns = source.getAttributeKeyNsAt(i);
            String value = source.getAttributeValue(key, ns);
            if (String.isNotBlank(ns)) {
                String prefix = 'attribute' + i;
                target.setNamespace(prefix, ns);
                key = prefix + ':' + key;
            }
            target.setAttribute(key, value);
        }
        List<Dom.XmlNode> children = source.getChildElements();
        if (children.isEmpty()) { target.addTextNode(source.getText() ?? ''); }
        for (Dom.XmlNode child : children) { copyDefinitionElement(child, target); }
    }

}