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

    /**
     * APIの拒否理由を認証情報を含まない固定形式へ変換
     * @param result 同じ項目と照合済みの失敗結果
     * @return 検証済みエラーコードだけを含む案内
     */
    public static String metadataUpdateError(Dom.XmlNode result) {
        // Salesforceの構造化属性で対象項目の拒否と分類値の拒否を区別
        Dom.XmlNode error = result.getChildElement('errors', 'http://soap.sforce.com/2006/04/metadata');
        // 自由文を解析せず公開コードだけを取得
        String code = error?.getChildElement('statusCode', 'http://soap.sforce.com/2006/04/metadata')?.getText();
        String safeCode = SalesforceApiProtocol.safeCode(code);
        // 項目名に対する選択リスト拒否を分類値や権限の問題と案内しない
        if (code == 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST' && error.getChildElement('fields', 'http://soap.sforce.com/2006/04/metadata')?.getText() == 'FieldOrColumn') {
            return '対象項目がMetadata APIの分類更新対象として拒否されました（' + safeCode + ' / FieldOrColumn）。この結果は分類値や権限不足を示すものではありません。';
        }
        // 詳細を特定できない拒否は原因を推測せずコードを表示
        return 'Metadata APIが更新を拒否しました（' + safeCode + '）。対象項目・分類値・APIの制約を確認してください。';
    }

    /** API応答行の存在・型と必須文字列を確認
     * @param value 未検証の応答行
     * @param keys 必須の文字列属性、空集合なら行の型だけを確認
     * @return 必須値が揃う場合true、任意属性のnullは許容
     */
    public static Boolean hasRequiredText(Object value, Set<String> keys) {
        // nullや別型をMapとして参照しない
        if (!(value instanceof Map<String, Object>) || keys == null) { return false; }
        Map<String, Object> row = (Map<String, Object>)value;
        for (String key : keys) {
            // 必須属性だけに空白判定を適用
            Object item = row.get(key);
            if (!(item instanceof String) || String.isBlank((String)item)) { return false; }
        }
        return true;
    }

    /** REST応答の対象識別子を検証 */
    public class RecordReader {
        /** 完了した日時応答の必須IDを確認して行へ変換
         * @param response Tooling APIの応答
         * @return 必須IDを確認した行、任意の日時・ユーザーIDはnullを許容
         */
        public List<Map<String, Object>> readAuditRecords(Map<String, Object> response) {
            // 未完了の一部応答を全件取得として扱わない
            if (response?.get('done') != true || !(response.get('records') instanceof List<Object>)) { throw ObjectExplorerAccessPolicy.createException('項目の作成・更新情報をすべて取得できませんでした。'); }
            // 後で要求ID・重複・欠落を確認できる形で保持
            List<Map<String, Object>> records = new List<Map<String, Object>>();
            // レコードの識別子を保ったまま型を統一
            for (Object value : (List<Object>)response.get('records')) {
                // 任意の日時・ユーザーIDは維持し、行と必須IDだけを検証
                Boolean valid = SalesforceApiProtocol.hasRequiredText(value, new Set<String>{ 'Id' });
                if (!valid) { throw ObjectExplorerAccessPolicy.createException('項目の作成・更新情報の行または識別子を確認できませんでした。'); }
                records.add((Map<String, Object>)value);
            }
            // 表示値への加工は全件照合の後に行う
            return records;
        }

        /** 本文なしの成功を空Mapへ変換し、JSON null・別型を拒否
         * @param body 外部APIの本文
         * @return nullを含まないオブジェクト応答
         */
        public Map<String, Object> readResponse(String body) {
            try {
                // HTTP成功とJSON形式の正常性を別々に確認する
                if (String.isBlank(body)) { return new Map<String, Object>(); }
                Object decoded = JSON.deserializeUntyped(body);
                // JSONのnullや別型を有効なオブジェクト応答として返さない
                if (!(decoded instanceof Map<String, Object>)) { throw new SalesforceApiClient.IntegrationException('API応答の形式が不正です。'); }
                return (Map<String, Object>)decoded;
            } catch (Exception error) {
                // 応答本文は公開せず形式不正だけを通知する
                throw new SalesforceApiClient.IntegrationException('[OE-API-RESPONSE] API応答をオブジェクト形式で読み取れませんでした。');
            }
        }

        /** 配列入力の空・長さ・構文・型を確認
         * @param inputJson 未検証JSON
         * @param maxLength 許可する最大文字数
         * @param message 固定の公開案内
         * @return 型確認済み配列
         */
        public List<Object> parseArray(String inputJson, Integer maxLength, String message) {
            AuraHandledException failure = new AuraHandledException(message);
            failure.setMessage(message);
            // 空入力を解析しない
            if (String.isBlank(inputJson) || inputJson.length() > maxLength) { throw failure; }
            Object parsed;
            try { parsed = JSON.deserializeUntyped(inputJson); }
            catch (JSONException e) { throw failure; }
            if (!(parsed instanceof List<Object>)) { throw failure; }
            return (List<Object>)parsed;
        }

        /**
         * APIクエリが期待した対象を一件だけ返したことを確認
         * @param response クエリ応答
         * @param idField 照合する識別子の属性名
         * @param expectedId 呼び出し元で確定した対象識別子
         * @return 対象の一致を確認した一件
         */
        public Map<String, Object> requireQueryRecord(Map<String, Object> response, String idField, String expectedId) {
            // 必須の比較条件を省略した照合は受け付けない
            if (String.isBlank(idField) || String.isBlank(expectedId)) { throw new SalesforceApiClient.IntegrationException('APIの確認対象を一意に取得できません。'); }
            Map<String, Object> record = readSingleRecord(response);
            Boolean identified = hasRequiredText(record, new Set<String>{ idField });
            if (!identified || (String)record.get(idField) != expectedId) { throw new SalesforceApiClient.IntegrationException('[OE-API-ID-MISMATCH] API応答の識別子が確認対象と一致しません。'); }
            return record;
        }
        /** 応答の配列・件数・行の型を確定
         * @param response 未検証のクエリ応答
         * @return 非nullの一件の行
         */
        private Map<String, Object> readSingleRecord(Map<String, Object> response) {
            if (!(response?.get('records') instanceof List<Object>)) { throw new SalesforceApiClient.IntegrationException('APIの確認対象を一意に取得できません。'); }
            List<Object> records = (List<Object>)response.get('records');
            if (records.size() != 1 || !(records[0] instanceof Map<String, Object>)) { throw new SalesforceApiClient.IntegrationException('APIの確認対象を一意に取得できません。'); }
            return (Map<String, Object>)records[0];
        }

    }

}
