/** Named Credential経由の項目メタデータ読み取り・更新 */
public with sharing class MetadataApiIntegrationClient {

    private static final String NAMED_CREDENTIAL = 'MetadataApiIntegration';
    private static final String API_VERSION = '68.0';
    private static final Integer REQUEST_TIMEOUT_MS = 30000;
    private static final Long REQUEST_BUDGET_MS = 100000;
    private static final Long DEADLINE = DateTime.now().getTime() + REQUEST_BUDGET_MS;

    /**
     * Named Credentialで認証したAPIを呼び出す
     * @param path 固定APIパス
     * @param method GETまたはPATCH
     * @param body 認証情報を含まない更新内容
     * @return JSON応答、本文のない成功時は空Map
     */
    public Map<String, Object> request(String path, String method, String body) {
        // JSONの文字列値を認証用の差し込み式として解釈させない
        String jsonBody = body?.replace('{!', '\\u007b!');
        HttpResponse response = sendRequest('/services/data/v' + API_VERSION + '/' + path, method, jsonBody);
        if (response.getStatusCode() / 100 != 2) {
            throw new IntegrationException('項目メタデータAPIが要求を受け付けませんでした（HTTP ' + response.getStatusCode() + '）。API実行権限・設定値を確認してください。');
        }
        return String.isBlank(response.getBody()) ? new Map<String, Object>() : (Map<String, Object>)JSON.deserializeUntyped(response.getBody());
    }

    /**
     * RESTとSOAPで同じ認証・待ち時間・通信エラー処理を使用
     * @param path 固定APIパス
     * @param method HTTPメソッド
     * @param body 認証値を含まない本文テンプレート
     * @return HTTP応答
     */
    private HttpResponse sendRequest(String path, String method, String body) {
        HttpRequest request = new HttpRequest();
        // 組織ごとの認証情報は共通名の指定ログイン情報で管理
        request.setEndpoint('callout:' + NAMED_CREDENTIAL + path);
        request.setMethod(method);
        Boolean soap = path.startsWith('/services/Soap/');
        request.setHeader('Content-Type', soap ? 'text/xml; charset=UTF-8' : 'application/json');
        if (soap) { request.setHeader('SOAPAction', 'updateMetadata'); }
        Long remaining = DEADLINE - DateTime.now().getTime();
        if (remaining <= 0) { throw new IntegrationException('API待ち時間の上限に達しました。最新状態を再取得してください。'); }
        request.setTimeout(Math.min(REQUEST_TIMEOUT_MS, remaining.intValue()));
        request.setBody(body ?? '');
        try { return new Http().send(request); }
        catch (CalloutException error) {
            throw new IntegrationException('API接続を確認できませんでした。認証設定を確認し、更新要求後の場合は最新状態を再取得してください。');
        }
    }

    /**
     * 接続先が実行中の組織であることを確認
     */
    public void verifyOrganization() {
        Map<String, Object> response = request('query/?q=SELECT+Id+FROM+Organization', 'GET', null);
        // 認証先の組織IDを応答検証へ渡す
        new RecordReader().requireQueryRecord(response, 'Id', String.valueOf(UserInfo.getOrganizationId()));
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
        return request(path, 'GET', null);
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
        Map<String, Object> payload = (Map<String, Object>)cleanMetadata(metadata);
        // 解除対象の分類属性は明示的なnullを維持
        for (String key : new List<String>{'businessOwnerUser', 'businessOwnerGroup', 'businessStatus', 'complianceGroup', 'securityClassification'}) { payload.put(key, metadata.get(key)); }
        // 検証済みの同じ項目へ定義を反映
        request(path, 'PATCH', JSON.serialize(new Map<String, Object>{'Metadata' => payload}));
    }

    /**
     * Tooling APIで受理されない未設定の複合属性を送信対象から除外
     * @param value 取得した定義、分類以外の設定済み値は維持
     * @return null属性を除いた同じ定義
     */
    private Object cleanMetadata(Object value) {
        if (value instanceof List<Object>) {
            List<Object> result = new List<Object>();
            for (Object item : (List<Object>)value) { result.add(cleanMetadata(item)); }
            return result;
        }
        if (!(value instanceof Map<String, Object>)) { return value; }
        return cleanMetadataObject((Map<String, Object>)value);
    }

    /**
     * 設定済み属性だけを同じキーで再帰処理
     * @param source 取得済み定義のオブジェクト
     * @return null属性を除いたオブジェクト
     */
    private Map<String, Object> cleanMetadataObject(Map<String, Object> source) {
        Map<String, Object> result = new Map<String, Object>();
        for (String key : source.keySet()) {
            if (source.get(key) == null) { continue; }
            result.put(key, cleanMetadata(source.get(key)));
        }
        return result;
    }

    /**
     * 分類3属性とネイティブ所有者IDを同じ要求で一括取得
     * @param objectName 検証済みオブジェクト名
     * @param fieldNames 検証済み項目名、最大10件
     * @return 項目API名で一意に照合した応答
     */
    public Map<String, Map<String, Object>> readClassifications(String objectName, Set<String> fieldNames) {
        if (fieldNames.isEmpty() || fieldNames.size() > 10) { throw new IntegrationException('分類の取得は1～10項目で指定してください。'); }
        List<String> names = new List<String>();
        for (String name : fieldNames) { requireFullName(objectName + '.' + name); names.add('\'' + name + '\''); }
        String query = 'SELECT DurableId, QualifiedApiName, ComplianceGroup, SecurityClassification, BusinessStatus, BusinessOwnerId FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = \''
            + String.escapeSingleQuotes(objectName) + '\' AND QualifiedApiName IN (' + String.join(names, ',') + ')';
        Map<String, Object> response = request('query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'), 'GET', null);
        // 件数・属性・項目名の照合を通信処理から分離
        return new RecordReader().readClassifications(response, fieldNames);
    }

    /**
     * 完全名へAPIパスやSOQLの断片を含めさせない
     * @param fullName オブジェクト名と項目名
     */
    private static void requireFullName(String fullName) {
        // 項目名に使用できる識別子だけを許可
        if (!Pattern.matches('[A-Za-z0-9_]+\\.[A-Za-z0-9_]+', fullName ?? '')) { throw new IntegrationException('項目識別子が不正です。'); }
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
        if (!Pattern.matches('00N[A-Za-z0-9]{12}([A-Za-z0-9]{3})?', fieldId)) { throw new IntegrationException('カスタム項目のIDが不正です。'); }
        // 検証済みIDだけでカスタム項目のパスを固定
        return 'tooling/sobjects/CustomField/' + fieldId;
    }

    /** 認証値やAPI応答本文を含まない連携エラー */
    public class IntegrationException extends Exception {}

    /** APIが明示的に拒否した分類更新 */
    public class RejectedUpdateException extends Exception {}
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
        HttpResponse response = sendRequest('/services/Soap/m/' + API_VERSION, 'POST', body);
        // 応答順に依存せず同じ完全名へ照合
        return protocol.readUpdateResults(response, fields.keySet());
    }

    /** REST応答の件数・必須属性・対象識別子を検証 */
    public class RecordReader {

        /**
         * 完全に取得した分類だけを項目名へ索引化
         * @param response 分類API応答
         * @param fieldNames 取得を要求した項目API名
         * @return 件数・属性・項目名を確認した分類
         */
        public Map<String, Map<String, Object>> readClassifications(Map<String, Object> response, Set<String> fieldNames) {
            List<Object> records = (List<Object>)response.get('records');
            if (records?.size() != fieldNames.size() || response.get('done') != true) { throw new IntegrationException('分類の取得結果に不足があります。'); }
            return indexClassifications(records, fieldNames);
        }

        /**
         * 取得項目の属性・重複・名前を検証して索引化
         * @param records 完全件数を取得済みのAPI応答
         * @param fieldNames 期待する項目名
         * @return 項目API名の索引
         */
        private Map<String, Map<String, Object>> indexClassifications(List<Object> records, Set<String> fieldNames) {
            Map<String, Map<String, Object>> rows = new Map<String, Map<String, Object>>();
            Set<String> required = new Set<String>{'DurableId', 'QualifiedApiName', 'ComplianceGroup', 'SecurityClassification', 'BusinessStatus', 'BusinessOwnerId'};
            for (Object item : records) {
                Map<String, Object> row = (Map<String, Object>)item;
                String name = (String)row.get('QualifiedApiName');
                if (!fieldNames.contains(name) || rows.containsKey(name) || !row.keySet().containsAll(required)) { throw new IntegrationException('分類の取得対象または属性が一致しません。'); }
                rows.put(name, row);
            }
            return rows;
        }

        /**
         * APIクエリが期待した対象を一件だけ返したことを確認
         * @param response クエリ応答
         * @param idField 照合する識別子の属性名
         * @param expectedId 呼び出し元で確定した対象識別子
         * @return 対象の一致を確認した一件
         */
        public Map<String, Object> requireQueryRecord(Map<String, Object> response, String idField, String expectedId) {
            List<Object> records = (List<Object>)response.get('records');
            if (records?.size() != 1) { throw new IntegrationException('APIの確認対象を一意に取得できません。'); }
            Map<String, Object> record = (Map<String, Object>)records[0];
            if (String.valueOf(record.get(idField)) != expectedId) { throw new IntegrationException('API応答の識別子が確認対象と一致しません。'); }
            return record;
        }
    }

}