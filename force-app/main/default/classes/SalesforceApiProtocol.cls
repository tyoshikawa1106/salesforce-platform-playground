/** API要求・応答の純粋な変換と機密情報を含まない固定診断 */
public with sharing class SalesforceApiProtocol {
    // エラーが発生した要求だけで構築し、項目別の拒否が続いても再利用
    private static Set<String> allowedCodes;
    /**
     * 応答本文を含まないHTTP診断を作成
     * @param response HTTP失敗の応答
     * @return 固定エラーコードとHTTP番号を含む公開メッセージ
     */
    public static String httpMessage(HttpResponse response) {
        Integer status = response.getStatusCode();
        String code = status == 401 ? 'OE-AUTH-401' : 'OE-API-HTTP-' + status;
        Map<Integer, String> reasons = new Map<Integer, String>{
            401 => 'APIが認証を拒否しました。',
            403 => 'APIへのアクセスが拒否されました。実行ユーザーの権限とアクセス条件を確認してください。',
            429 => 'APIの呼び出しが制限されました。時間をおいて最新状態を確認してください。'
        };
        // サーバー側の失敗を認証や権限不足と断定しない
        String fallback = status >= 500 ? 'APIサーバーが要求を処理できませんでした。最新状態を確認してください。' : 'APIが要求を受け付けませんでした。対象・設定値・公開エラーコードを確認してください。';
        String reason = reasons.get(status) ?? fallback;
        String apiCode = publicCode(response.getBody());
        return '[' + code + '] ' + reason + '（HTTP ' + status + '）' + apiCode;
    }

    /**
     * RESTとSOAPのエラーコードを公式の列挙値と固定のRESTコードへ限定
     * @param value 応答に含まれる未検証のコード
     * @return 公式コード、未登録の値はUNRECOGNIZED_API_ERROR_CODE
     */
    public static String safeCode(String value) {
        // 公式コードの列挙を同じApex要求で繰り返さない
        if (allowedCodes == null) {
            // REST固有コードを含む従来の公開範囲を維持
            allowedCodes = new Set<String>{'INVALID_SESSION_ID', 'API_DISABLED_FOR_ORG', 'INSUFFICIENT_ACCESS', 'INSUFFICIENT_ACCESS_OR_READONLY', 'INVALID_FIELD', 'INVALID_TYPE', 'MALFORMED_QUERY', 'INVALID_OPERATION', 'REQUEST_LIMIT_EXCEEDED', 'NOT_FOUND', 'FIELD_INTEGRITY_EXCEPTION', 'INVALID_CROSS_REFERENCE_KEY', 'DUPLICATE_VALUE', 'INVALID_TYPE_FOR_OPERATION', 'UNKNOWN_EXCEPTION', 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', 'CANNOT_MODIFY_MANAGED_OBJECT', 'JSON_PARSER_ERROR'};
            // 手動一覧にない公式の業務・定義エラーも公開可能にする
            for (System.StatusCode code : System.StatusCode.values()) { allowedCodes.add(String.valueOf(code)); }
        }
        // 実際のAPIコードと診断側の未認識を区別
        return allowedCodes.contains(value) ? value : 'UNRECOGNIZED_API_ERROR_CODE';
    }

    /**
     * APIの自由文や未知のコードを除き、許可済みコードだけを公開
     * @param body エラー応答、画面とログへ本文を渡さない
     * @return Salesforceエラーコードの固定表記、取得不可時は空文字
     */
    private static String publicCode(String body) {
        // 巨大な本文の再解析や任意の識別子の公開を避ける
        if (String.isBlank(body) || body.length() > 20000) { return ''; }
        try {
            Object decoded = JSON.deserializeUntyped(body);
            if (!(decoded instanceof List<Object>)) { return ''; }
            List<Object> records = (List<Object>)decoded;
            if (records.isEmpty() || !(records[0] instanceof Map<String, Object>)) { return ''; }
            Object value = ((Map<String, Object>)records[0]).get('errorCode');
            if (value instanceof String) { return ' Salesforceコード：' + safeCode((String)value); }
        } catch (Exception error) {
            // 不正な本文でも元のHTTP番号による診断を維持する
            return '';
        }
        return '';
    }

    /**
     * 接続例外本文を公開せず、既知の待ち時間超過だけを分類
     * @param detail 通信例外の本文、固定文言の判定にのみ使用
     * @return 値を含まない固定メッセージ
     */
    public static String connectionMessage(String detail) {
        String normalized = (detail ?? '').toLowerCase();
        if (normalized.contains('read timed out') || normalized.contains('connect timed out')) {
            return '[OE-API-TIMEOUT] API応答が制限時間内に届きませんでした。更新要求後の場合は最新状態を再取得してください。';
        }
        return '[OE-API-CONNECTION] API接続を確認できませんでした。認証設定または通信経路を確認してください。更新要求後の場合は最新状態を再取得してください。';
    }

    /** エラー本文を公開できるかの固定区分 */
    public enum Publication { CONTROLLED, INTERNAL }

    /**
     * 呼出元が公開可否を検証した理由だけを画面用例外へ変換
     * @param error 元の例外、未知の本文は公開しない
     * @param stage 固定の処理段階
     * @param policy 呼出元で確認した公開区分
     * @return 内部本文を含まない公開例外
     */
    public static AuraHandledException publicException(Exception error, String stage, Publication policy) {
        String message = policy == Publication.CONTROLLED ? error.getMessage() : '処理に失敗しました。参照権限とAPI連携設定を確認してください。';
        AuraHandledException result = new AuraHandledException(stage + '：' + message);
        result.setMessage(stage + '：' + message);
        return result;
    }

    /** REST応答の対象識別子を検証 */
    public class RecordReader {
        /**
         * APIクエリが期待した対象を一件だけ返したことを確認
         * @param response クエリ応答
         * @param idField 照合する識別子の属性名
         * @param expectedId 呼び出し元で確定した対象識別子
         * @return 対象の一致を確認した一件
         */
        public Map<String, Object> requireQueryRecord(Map<String, Object> response, String idField, String expectedId) {
            List<Object> records = (List<Object>)response.get('records');
            if (records?.size() != 1) { throw new SalesforceApiClient.IntegrationException('APIの確認対象を一意に取得できません。'); }
            Map<String, Object> record = (Map<String, Object>)records[0];
            if (String.valueOf(record.get(idField)) != expectedId) { throw new SalesforceApiClient.IntegrationException('[OE-API-ID-MISMATCH] API応答の識別子が確認対象と一致しません。'); }
            return record;
        }
    }

}