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
            IntegrationException failure = new IntegrationException(MetadataApiProtocol.httpMessage(response));
            // 更新要求の明示的な拒否だけを、結果不明と区別する
            if (method == 'PATCH' && new Set<Integer>{400, 401, 403, 404, 409, 422, 429}.contains(response.getStatusCode())) { throw new RejectedUpdateException(failure.getMessage()); }
            throw failure;
        }
        try {
            // HTTP成功とJSON形式の正常性を別々に確認する
            return String.isBlank(response.getBody()) ? new Map<String, Object>() : (Map<String, Object>)JSON.deserializeUntyped(response.getBody());
        } catch (Exception error) {
            // 応答本文は公開せず形式不正だけを通知する
            throw new IntegrationException('[OE-API-RESPONSE] API応答をオブジェクト形式で読み取れませんでした。');
        }
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
        if (remaining <= 0) { throw new IntegrationException('[OE-API-BUDGET] API待ち時間の上限に達しました。最新状態を再取得してください。'); }
        request.setTimeout(Math.min(REQUEST_TIMEOUT_MS, remaining.intValue()));
        request.setBody(body ?? '');
        try { return new Http().send(request); }
        catch (CalloutException error) {
            // 本文の判定と公開可能な理由の作成を純粋な変換へ委譲する
            throw new IntegrationException(MetadataApiProtocol.connectionMessage(error.getMessage()));
        }
    }

    /**
     * 接続先が実行中の組織であることを確認
     */
    public void verifyOrganization() {
        Map<String, Object> response = request('query/?q=SELECT+Id+FROM+Organization', 'GET', null);
        // 認証先の組織IDを応答検証へ渡す
        try {
            // 現在組織と認証先の識別子だけを比較する
            new MetadataApiProtocol.RecordReader().requireQueryRecord(response, 'Id', String.valueOf(UserInfo.getOrganizationId()));
        } catch (IntegrationException error) {
            // 識別子不一致と応答不備を区別し、組織IDは公開しない
            if (error.getMessage().startsWith('[OE-API-ID-MISMATCH]')) { throw new IntegrationException('[OE-ORG-MISMATCH] API接続先がこのSalesforce組織と一致しません。'); }
            throw new IntegrationException('[OE-ORG-RESPONSE] API接続先の組織情報を確認できませんでした。');
        }

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
        Map<String, Object> payload = (Map<String, Object>)MetadataApiProtocol.cleanMetadata(metadata);
        // 解除対象の分類属性は明示的なnullを維持
        for (String key : new List<String>{'businessOwnerUser', 'businessOwnerGroup', 'businessStatus', 'complianceGroup', 'securityClassification'}) { payload.put(key, metadata.get(key)); }
        // 検証済みの同じ項目へ定義を反映
        request(path, 'PATCH', JSON.serialize(new Map<String, Object>{'Metadata' => payload}));
    }

    /**
     * 分類3属性とネイティブ所有者IDを同じ要求で一括取得
     * @param objectName 検証済みオブジェクト名
     * @param fieldNames 検証済み項目名、最大10件
     * @return 項目API名で一意に照合した応答
     */
    public Map<String, Map<String, Object>> readClassifyData(String objectName, Set<String> fieldNames) {
        if (fieldNames.isEmpty() || fieldNames.size() > 10) { throw new IntegrationException('分類の取得は1～10項目で指定してください。'); }
        List<String> names = new List<String>();
        for (String name : fieldNames) { requireFullName(objectName + '.' + name); names.add('\'' + name + '\''); }
        String query = 'SELECT DurableId, QualifiedApiName, ComplianceGroup, SecurityClassification, BusinessStatus, BusinessOwnerId FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = \''
            + String.escapeSingleQuotes(objectName) + '\' AND QualifiedApiName IN (' + String.join(names, ',') + ')';
        Map<String, Object> response = request('query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'), 'GET', null);
        // 件数・属性・項目名の照合を通信処理から分離
        return new MetadataApiProtocol.RecordReader().readClassifyData(response, fieldNames);
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
        // 認証とアクセス拒否はSOAP解析より前に共通形式で通知する
        if (new Set<Integer>{401, 403, 429}.contains(response.getStatusCode())) { throw new RejectedUpdateException(MetadataApiProtocol.httpMessage(response)); }
        // 応答順に依存せず同じ完全名へ照合
        return protocol.readUpdateResults(response, fields.keySet());
    }
}
