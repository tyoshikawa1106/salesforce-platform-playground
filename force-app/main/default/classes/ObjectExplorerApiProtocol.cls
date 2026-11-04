/** オブジェクト探索の分類応答・更新定義・保存状態の変換 */
public with sharing class ObjectExplorerApiProtocol {
    /** 分類保存で確定した送信と拒否の状態 */
    public class SaveState {
        public Boolean sent = false;
        public Boolean rejected = false;
    }

    /**
     * 更新前・明示拒否・結果不明を区別
     * @param state 更新要求の送信・拒否状態
     * @return 項目値を含まない固定の保存段階
     */
    public static String saveStage(SaveState state) {
        if (state.rejected) { return '[OE-SAVE-REJECTED] APIによる更新拒否'; }
        return state.sent ? '[OE-SAVE-UNCONFIRMED] 更新送信後の確認' : '[OE-SAVE-PRECHECK] 更新前の確認';
    }
    /**
     * 内部例外を公開せず制御した業務エラーだけを表示
     * @param error 保存中の例外
     * @return 利用者へ返せる固定形式のメッセージ
     */
    public static String safeSaveMessage(Exception error) {
        return error instanceof AuraHandledException || error instanceof SalesforceApiClient.IntegrationException || error instanceof SalesforceApiClient.RejectedUpdateException ? error.getMessage() : '項目の保存に失敗しました。編集内容と権限を確認してください。';
    }
    /** ネイティブ項目定義とREST応答の分類レコードを照合用の索引へ変換 */
    public class RecordReader {

        /**
         * 保存前に取得した項目定義を分類照合用の索引へ変換
         * @param definitions 対象名と識別子を確認済みのネイティブ項目定義
         * @return 同じ項目の分類と所有者ID
         */
        public Map<String, Map<String, Object>> createFieldRows(List<FieldDefinition> definitions) {
            // 取得済みの定義を再通信せず照合へ渡す
            Map<String, Map<String, Object>> rows = new Map<String, Map<String, Object>>();
            // 対象を照合済みのレコードだけを同じAPI名へ対応付け
            for (FieldDefinition definition : definitions) {
                // 未設定の分類もnullのまま保持
                rows.put(definition.QualifiedApiName, new Map<String, Object>{
                    'QualifiedApiName' => definition.QualifiedApiName, 'DurableId' => definition.DurableId,
                    'ComplianceGroup' => definition.ComplianceGroup, 'SecurityClassification' => definition.SecurityClassification,
                    'BusinessStatus' => definition.BusinessStatus, 'BusinessOwnerId' => (String)definition.BusinessOwnerId
                });
            }
            // 分類照合と所有者取得で同じ索引を共用
            return rows;
        }

        /**
         * 完全に取得した分類だけを項目名へ索引化
         * @param response 分類API応答
         * @param fieldNames 取得を要求した項目API名
         * @return 件数・属性・項目名を確認した分類
         */
        public Map<String, Map<String, Object>> readClassifyData(Map<String, Object> response, Set<String> fieldNames) {
            List<Object> records = (List<Object>)response.get('records');
            if (records?.size() != fieldNames.size() || response.get('done') != true) { throw new SalesforceApiClient.IntegrationException('分類の取得結果に不足があります。'); }
            return indexClassifyData(records, fieldNames);
        }

        /**
         * 取得項目の属性・重複・名前を検証して索引化
         * @param records 完全件数を取得済みのAPI応答
         * @param fieldNames 期待する項目名
         * @return 項目API名の索引
         */
        private Map<String, Map<String, Object>> indexClassifyData(List<Object> records, Set<String> fieldNames) {
            Map<String, Map<String, Object>> rows = new Map<String, Map<String, Object>>();
            Set<String> required = new Set<String>{'DurableId', 'QualifiedApiName', 'ComplianceGroup', 'SecurityClassification', 'BusinessStatus', 'BusinessOwnerId'};
            for (Object item : records) {
                Map<String, Object> row = (Map<String, Object>)item;
                String name = (String)row.get('QualifiedApiName');
                if (!fieldNames.contains(name) || rows.containsKey(name) || !row.keySet().containsAll(required)) { throw new SalesforceApiClient.IntegrationException('分類の取得対象または属性が一致しません。'); }
                rows.put(name, row);
            }
            return rows;
        }

    }
    /** カスタム項目定義の読取・分類置換と複合XMLの保持 */
    public class CustomFieldCodec {
        private final String metadataNamespace = 'http://soap.sforce.com/2006/04/metadata';
        private MetadataApiSoapCodec soap = new MetadataApiSoapCodec();
        /**
         * 標準・カスタム項目の分類を同じ要求で一括更新するSOAP本文を生成
         * @param fields 検証済み完全名と分類5属性の対応
         * @param definitions 最新のカスタム定義、標準項目は含めない
         * @return 認証差し込み箇所を限定したSOAP本文
         */
        public String createUpdateRequest(Map<String, Map<String, Object>> fields, Map<String, Dom.XmlNode> definitions) {
            requireBatch(fields.keySet());
            Dom.Document doc = soap.createRequestDocument('updateMetadata');
            // 一項目の拒否で他項目の成功を取り消さない
            doc.getRootElement().getChildElement('Header', 'http://schemas.xmlsoap.org/soap/envelope/').addChildElement('AllOrNoneHeader', metadataNamespace, 'met').addChildElement('allOrNone', metadataNamespace, 'met').addTextNode('false');
            Dom.XmlNode operation = doc.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('updateMetadata', metadataNamespace);
            for (String fullName : fields.keySet()) {
                // 同じ項目の完全名と属性を一つの単位でXMLへ追加
                if (definitions.containsKey(fullName)) {
                    Map<String, Object> classification = new Map<String, Object>(fields.get(fullName));
                    classification.put('fullName', fullName);
                    appendCustomDefinition(operation, definitions.get(fullName), classification);
                } else { soap.appendMetadataField(operation, fullName, fields.get(fullName)); }
            }
            return soap.serializeRequest(doc);
        }

        /**
         * カスタム項目の最新定義を取得するSOAP要求を生成
         * @param fullNames 検証済みの項目完全名、1～10件
         * @return 認証欄だけに差し込みを許可した本文
         */
        public String createReadRequest(Set<String> fullNames) {
            requireBatch(fullNames);
            Dom.Document doc = soap.createRequestDocument('readMetadata');
            Dom.XmlNode operation = doc.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('readMetadata', metadataNamespace);
            operation.addChildElement('type', metadataNamespace, 'met').addTextNode('CustomField');
            for (String fullName : fullNames) {
                soap.requireFullName(fullName);
                operation.addChildElement('fullNames', metadataNamespace, 'met').addTextNode(fullName);
            }
            return soap.serializeRequest(doc);
        }

        /**
         * 完全名と型を照合した最新カスタム定義を取得
         * @param response Metadata APIの読取応答
         * @param fullNames 要求した同じ項目完全名
         * @return 完全名で照合し分類以外も保持するXML定義
         */
        public Map<String, Dom.XmlNode> readCustomDefinitions(HttpResponse response, Set<String> fullNames) {
            requireBatch(fullNames);
            Dom.XmlNode operation = soap.readOperation(response, 'readMetadataResponse', 'Metadata APIの項目定義を取得できませんでした。最新状態を再取得してください。');
            Map<String, Dom.XmlNode> definitions = new Map<String, Dom.XmlNode>();
            List<Dom.XmlNode> records = operation.getChildElement('result', metadataNamespace)?.getChildElements();
            if (records == null) { throw new SalesforceApiClient.IntegrationException('Metadata APIの項目定義を確認できませんでした。'); }
            for (Dom.XmlNode record : records) {
                String fullName = record.getChildElement('fullName', metadataNamespace)?.getText();
                requireDefinition(record, fullNames);
                if (definitions.containsKey(fullName)) { throw new SalesforceApiClient.IntegrationException('取得したカスタム項目定義が一致しません。'); }
                definitions.put(fullName, record);
            }
            if (definitions.keySet() != fullNames) { throw new SalesforceApiClient.IntegrationException('Metadata APIの項目定義に不足があります。'); }
            return definitions;
        }

        /**
         * 同じ完全名と型を持つ項目定義だけを採用
         * @param record 読取応答の一要素
         * @param names 要求した完全名
         */
        private void requireDefinition(Dom.XmlNode record, Set<String> names) {
            if (record.getName() != 'records' || !names.contains(record.getChildElement('fullName', metadataNamespace)?.getText()) || record.getChildElement('type', metadataNamespace) == null) {
                throw new SalesforceApiClient.IntegrationException('取得したカスタム項目定義が一致しません。');
            }
        }

        /**
         * 定義読取の件数をAPI上限へ限定
         * @param fullNames 取得対象の完全名
         */
        private void requireBatch(Set<String> fullNames) {
            if (fullNames == null || fullNames.isEmpty() || fullNames.size() > 10) { throw new SalesforceApiClient.IntegrationException('項目の一括処理は1～10件で指定してください。'); }
        }

        /**
         * 読取済み定義の分類属性だけを置換して更新要求を生成
         * @param operation 一括更新の操作要素
         * @param definition 取得済みの完全なXML定義
         * @param classification 検証済みの分類5属性
         */
        public void appendCustomDefinition(Dom.XmlNode operation, Dom.XmlNode definition, Map<String, Object> classification) {
            String fullName = (String)classification.get('fullName');
            soap.requireFullName(fullName);
            if (definition?.getChildElement('fullName', metadataNamespace)?.getText() != fullName) { throw new SalesforceApiClient.IntegrationException('保存するカスタム項目定義が一致しません。'); }
            Dom.XmlNode field = operation.addChildElement('metadata', metadataNamespace, 'met');
            field.setAttribute('xsi:type', 'met:CustomField');
            // CustomFieldの属性順序を維持して未設定の分類属性も追加する
            List<String> keys = new List<String>{'businessOwnerGroup', 'businessOwnerUser', 'businessStatus', 'complianceGroup', 'securityClassification'};
            Integer index = 0;
            for (Dom.XmlNode child : definition.getChildElements()) {
                String name = child.getName();
                while (index < keys.size() && name != 'fullName' && keys[index].compareTo(name) <= 0) {
                    String key = keys[index++];
                    field.addChildElement(key, metadataNamespace, 'met').addTextNode((String)classification.get(key) ?? '');
                }
                if (!keys.contains(name)) { copyDefinitionElement(child, field); }
            }
        }

        /**
         * 分類以外の複合定義を型変換せずXMLとして複製
         * @param source 取得した要素
         * @param parent 複製先の親要素
         */
        private void copyDefinitionElement(Dom.XmlNode source, Dom.XmlNode parent) {
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
}
