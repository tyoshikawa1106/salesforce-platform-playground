/** API要求・応答の純粋な変換と機密情報を含まない固定診断 */
public with sharing class MetadataApiProtocol {
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
     * RESTとSOAPのエラーコードを同じ許可範囲へ限定
     * @param value 応答に含まれる未検証のコード
     * @return 許可済みコード、未知の値はUNKNOWN_ERROR
     */
    public static String safeCode(String value) {
        Set<String> allowed = new Set<String>{'INVALID_SESSION_ID', 'API_DISABLED_FOR_ORG', 'INSUFFICIENT_ACCESS', 'INSUFFICIENT_ACCESS_OR_READONLY', 'INVALID_FIELD', 'INVALID_TYPE', 'MALFORMED_QUERY', 'INVALID_OPERATION', 'REQUEST_LIMIT_EXCEEDED', 'NOT_FOUND', 'FIELD_INTEGRITY_EXCEPTION', 'INVALID_CROSS_REFERENCE_KEY', 'DUPLICATE_VALUE', 'INVALID_TYPE_FOR_OPERATION', 'UNKNOWN_EXCEPTION', 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', 'CANNOT_MODIFY_MANAGED_OBJECT'};
        return allowed.contains(value) ? value : 'UNKNOWN_ERROR';
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

    /** 分類保存で確定した送信と拒否の状態 */
    public class SaveState {
        public Boolean sent = false;
        public Boolean rejected = false;
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
     * Tooling APIで受理されない未設定の複合属性を送信対象から除外
     * @param value 取得した定義、分類以外の設定済み値は維持
     * @return null属性を除いた同じ定義
     */
    public static Object cleanMetadata(Object value) {
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
    private static Map<String, Object> cleanMetadataObject(Map<String, Object> source) {
        Map<String, Object> result = new Map<String, Object>();
        for (String key : source.keySet()) {
            if (source.get(key) == null) { continue; }
            result.put(key, cleanMetadata(source.get(key)));
        }
        return result;
    }

    /** REST応答の件数・必須属性・対象識別子を検証 */
    public class RecordReader {

        /**
         * 完全に取得した分類だけを項目名へ索引化
         * @param response 分類API応答
         * @param fieldNames 取得を要求した項目API名
         * @return 件数・属性・項目名を確認した分類
         */
        public Map<String, Map<String, Object>> readClassifyData(Map<String, Object> response, Set<String> fieldNames) {
            List<Object> records = (List<Object>)response.get('records');
            if (records?.size() != fieldNames.size() || response.get('done') != true) { throw new MetadataApiIntegrationClient.IntegrationException('分類の取得結果に不足があります。'); }
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
                if (!fieldNames.contains(name) || rows.containsKey(name) || !row.keySet().containsAll(required)) { throw new MetadataApiIntegrationClient.IntegrationException('分類の取得対象または属性が一致しません。'); }
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
            if (records?.size() != 1) { throw new MetadataApiIntegrationClient.IntegrationException('APIの確認対象を一意に取得できません。'); }
            Map<String, Object> record = (Map<String, Object>)records[0];
            if (String.valueOf(record.get(idField)) != expectedId) { throw new MetadataApiIntegrationClient.IntegrationException('[OE-API-ID-MISMATCH] API応答の識別子が確認対象と一致しません。'); }
            return record;
        }
    }

}
