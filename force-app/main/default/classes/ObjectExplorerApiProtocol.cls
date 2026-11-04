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
}
