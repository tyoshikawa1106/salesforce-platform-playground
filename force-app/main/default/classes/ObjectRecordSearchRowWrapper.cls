/**
 * 汎用レコード検索画面の一覧行 Wrapper です。
 */
public with sharing class ObjectRecordSearchRowWrapper {
    /**
     * レコード ID です。
     */
    @AuraEnabled
    public Id id { get; private set; }

    /**
     * Name 相当項目の表示値です。
     */
    @AuraEnabled
    public String name { get; private set; }

    /**
     * Salesforce 標準詳細ページの相対 URL です。
     */
    @AuraEnabled
    public String recordUrl { get; private set; }

    /**
     * 固定表示項目の値です。
     */
    @AuraEnabled
    public Map<String, String> fieldValues { get; private set; }

    /**
     * 検索結果 SObject から一覧行を作成します。
     *
     * @param record 検索結果 SObject
     * @param nameFieldApiName Name 相当項目 API 参照名
     * @param displayFields 一覧に追加表示する固定項目
     */
    public ObjectRecordSearchRowWrapper(
        SObject record,
        String nameFieldApiName,
        List<ObjectRecordSearchFieldWrapper> displayFields
    ) {
        id = (Id) record.get('Id');
        Object rawName = record.get(nameFieldApiName);
        name = rawName == null ? String.valueOf(id) : String.valueOf(rawName);
        recordUrl =
            '/lightning/r/' +
            record.getSObjectType().getDescribe().getName() +
            '/' +
            String.valueOf(id) +
            '/view';
        fieldValues = createFieldValues(record, displayFields);
    }

    private Map<String, String> createFieldValues(
        SObject record,
        List<ObjectRecordSearchFieldWrapper> displayFields
    ) {
        Map<String, String> valuesByField = new Map<String, String>();
        for (ObjectRecordSearchFieldWrapper displayField : displayFields) {
            valuesByField.put(
                displayField.apiName,
                formatValue(record.get(displayField.apiName))
            );
        }
        return valuesByField;
    }

    private String formatValue(Object value) {
        if (value == null) {
            return '';
        }
        return String.valueOf(value);
    }
}
