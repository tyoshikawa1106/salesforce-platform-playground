/**
 * 汎用レコード検索画面で使う Salesforce レコードを問い合わせます。
 */
public virtual with sharing class ObjectRecordSearchSelector {
    /**
     * 対象オブジェクトの describe 結果を返します。
     * @param objectApiName 対象オブジェクト API 参照名
     * @return 対象オブジェクトの describe 結果
     */
    public virtual Schema.DescribeSObjectResult getObjectDescribe(
        String objectApiName
    ) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(objectApiName);
        if (sObjectType == null) {
            throw new ObjectRecordSearchException(
                '対象オブジェクトが見つかりません。'
            );
        }

        Schema.DescribeSObjectResult objectDescribe = sObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        if (!objectDescribe.isAccessible() || !objectDescribe.isQueryable()) {
            throw new ObjectRecordSearchException(
                '対象オブジェクトを参照できません。'
            );
        }
        return objectDescribe;
    }

    /**
     * 対象オブジェクトの Name 相当項目の describe 結果を返します。
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return Name 相当項目の describe 結果
     */
    public virtual Schema.DescribeFieldResult getNameFieldDescribe(
        Schema.DescribeSObjectResult objectDescribe
    ) {
        Schema.DescribeFieldResult nameFieldDescribe;

        for (
            Schema.SObjectField fieldToken : objectDescribe.fields.getMap()
                .values()
        ) {
            Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
            if (fieldDescribe.isNameField()) {
                nameFieldDescribe = fieldDescribe;
                break;
            }
        }

        if (
            nameFieldDescribe == null &&
            objectDescribe.fields.getMap().containsKey('Name')
        ) {
            nameFieldDescribe = objectDescribe.fields.getMap()
                .get('Name')
                .getDescribe();
        }

        if (nameFieldDescribe == null) {
            throw new ObjectRecordSearchException(
                'Name 項目を取得できません。'
            );
        }

        if (!nameFieldDescribe.isAccessible()) {
            throw new ObjectRecordSearchException(
                'Name 項目を参照できません。'
            );
        }
        return nameFieldDescribe;
    }

    /**
     * 作成済みの検索クエリ計画でレコードを取得します。
     * @param searchQuery 実行する SOQL と bind 値
     * @return 検索結果 SObject
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual List<SObject> searchRecords(
        ObjectRecordSearchQueryPlan.SearchQuery searchQuery
    ) {
        return Database.queryWithBinds(
            searchQuery.soql,
            searchQuery.bindValues,
            AccessLevel.USER_MODE
        );
    }

    /**
     * 対象オブジェクトから ID 指定で削除対象レコードを取得します。
     * @param objectApiName 対象オブジェクト API 参照名
     * @param recordIds 取得するレコード ID
     * @return 削除対象 SObject
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual List<SObject> getRecordsById(
        String objectApiName,
        Set<Id> recordIds
    ) {
        if (recordIds == null || recordIds.isEmpty()) {
            return new List<SObject>();
        }

        return Database.queryWithBinds(
            'SELECT Id FROM ' +
                objectApiName +
                ' WHERE Id IN :recordIds LIMIT ' +
                recordIds.size(),
            new Map<String, Object>{ 'recordIds' => recordIds },
            AccessLevel.USER_MODE
        );
    }

    /**
     * 指定レコードを削除します。
     * @param recordsToDelete 削除対象レコード
     * @return DML 削除結果
     */
    public virtual List<Database.DeleteResult> deleteRecords(
        List<SObject> recordsToDelete
    ) {
        return Database.delete(recordsToDelete, false, AccessLevel.USER_MODE);
    }
}
