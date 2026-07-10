/**
 * 汎用レコード検索画面で使う Salesforce レコードを問い合わせます。
 */
public virtual with sharing class ObjectRecordSearchSelector {
    /**
     * 対象オブジェクトの describe 結果を返します。
     *
     * @param objectApiName 対象オブジェクト API 参照名。
     * @return 対象オブジェクトの describe 結果。
     * @throws ObjectRecordSearchException 対象オブジェクトを検索できない場合。
     */
    public virtual Schema.DescribeSObjectResult getObjectDescribe(
        String objectApiName
    ) {
        Map<String, Schema.SObjectType> sObjectTypesByApiName = Schema.getGlobalDescribe();
        Schema.SObjectType sObjectType = sObjectTypesByApiName.get(
            objectApiName
        );
        if (sObjectType == null) {
            throw new ObjectRecordSearchException(
                '対象オブジェクトが見つかりません。'
            );
        }

        Schema.DescribeSObjectResult objectDescribe = sObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        Boolean isObjectAccessible = objectDescribe.isAccessible();
        Boolean isObjectQueryable = objectDescribe.isQueryable();
        if (!isObjectAccessible || !isObjectQueryable) {
            throw new ObjectRecordSearchException(
                '対象オブジェクトを参照できません。'
            );
        }
        return objectDescribe;
    }

    /**
     * 対象オブジェクトの Name 相当項目の describe 結果を返します。
     *
     * @param objectDescribe 対象オブジェクトの describe 結果。
     * @return Name 相当項目の describe 結果。
     * @throws ObjectRecordSearchException Name 相当項目を参照できない場合。
     */
    public virtual Schema.DescribeFieldResult getNameFieldDescribe(
        Schema.DescribeSObjectResult objectDescribe
    ) {
        Schema.DescribeFieldResult nameFieldDescribe;
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        List<Schema.SObjectField> fieldTokens = fieldsByApiName.values();

        for (Schema.SObjectField fieldToken : fieldTokens) {
            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            Boolean isNameField = fieldDescribe.isNameField();
            if (isNameField) {
                nameFieldDescribe = fieldDescribe;
                break;
            }
        }

        Boolean hasNameField = fieldsByApiName.containsKey('Name');
        if (
            nameFieldDescribe == null &&
            hasNameField
        ) {
            nameFieldDescribe = fieldsByApiName.get('Name').getDescribe();
        }

        if (nameFieldDescribe == null) {
            throw new ObjectRecordSearchException(
                'Name 項目を取得できません。'
            );
        }

        Boolean isNameFieldAccessible = nameFieldDescribe.isAccessible();
        if (!isNameFieldAccessible) {
            throw new ObjectRecordSearchException(
                'Name 項目を参照できません。'
            );
        }
        return nameFieldDescribe;
    }

    /**
     * 作成済みの検索クエリ計画でレコードを取得します。
     *
     * @param searchQuery 実行する SOQL と bind 値。
     * @return 検索結果 SObject。
     * @throws ObjectRecordSearchException 検索クエリ計画が不完全な場合。
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual List<SObject> searchRecords(
        ObjectRecordSearchQueryPlan.SearchQuery searchQuery
    ) {
        Boolean hasSearchQuery = searchQuery != null &&
            String.isNotBlank(searchQuery.soql) &&
            searchQuery.bindValues != null;
        if (!hasSearchQuery) {
            throw new ObjectRecordSearchException(
                '検索条件を作成できません。'
            );
        }

        return Database.queryWithBinds(
            searchQuery.soql,
            searchQuery.bindValues,
            AccessLevel.USER_MODE
        );
    }

    /**
     * 対象オブジェクトから ID 指定で削除対象レコードを取得します。
     *
     * @param objectApiName 対象オブジェクト API 参照名。
     * @param recordIds 取得するレコード ID。
     * @return 削除対象 SObject。
     * @throws ObjectRecordSearchException 対象オブジェクトがカタログ外の場合。
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual List<SObject> getRecordsById(
        String objectApiName,
        Set<Id> recordIds
    ) {
        Boolean hasRecordIds = recordIds != null && !recordIds.isEmpty();
        if (!hasRecordIds) {
            return new List<SObject>();
        }

        requireSupportedObject(objectApiName);

        String soql = 'SELECT Id FROM ' +
            objectApiName +
            ' WHERE Id IN :recordIds LIMIT ' +
            recordIds.size();
        Map<String, Object> bindValues = new Map<String, Object>{
            'recordIds' => recordIds
        };

        return Database.queryWithBinds(
            soql,
            bindValues,
            AccessLevel.USER_MODE
        );
    }

    /**
     * 指定レコードを削除します。
     *
     * @param recordsToDelete 削除対象レコード。
     * @return DML 削除結果。
     */
    public virtual List<Database.DeleteResult> deleteRecords(
        List<SObject> recordsToDelete
    ) {
        Boolean hasRecordsToDelete = recordsToDelete != null &&
            !recordsToDelete.isEmpty();
        if (!hasRecordsToDelete) {
            return new List<Database.DeleteResult>();
        }

        return Database.delete(recordsToDelete, false, AccessLevel.USER_MODE);
    }

    private void requireSupportedObject(String objectApiName) {
        Boolean hasObjectApiName = String.isNotBlank(objectApiName);
        Boolean isSupportedObject = hasObjectApiName &&
            ObjectMetricCatalog.hasObjectApiName(objectApiName);
        if (!isSupportedObject) {
            throw new ObjectRecordSearchException('未対応のオブジェクトです。');
        }
    }
}
