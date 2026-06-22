/**
 * 汎用レコード検索画面で使う Salesforce レコードを問い合わせます。
 */
public virtual with sharing class ObjectRecordSearchSelector {
    private static final Integer MAX_ROWS = 200;

    /**
     * 表示キーに対応する検索画面設定を返します。
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    public virtual ObjectRecordSearchController.ObjectRecordSearchConfig getObjectConfig(
        String metricKey
    ) {
        ObjectMetricCatalog.MetricDefinition definition = requireDefinition(
            metricKey
        );
        Schema.DescribeSObjectResult objectDescribe = requireObjectDescribe(
            definition
        );
        Schema.DescribeFieldResult nameFieldDescribe = requireNameFieldDescribe(
            objectDescribe
        );

        return new ObjectRecordSearchController.ObjectRecordSearchConfig(
            definition,
            objectDescribe,
            nameFieldDescribe
        );
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索します。
     * @param metricKey データボードカードの表示キー
     * @param searchTerm Name 項目に対する検索語
     * @return 最大 200 件の検索結果
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual ObjectRecordSearchController.ObjectRecordSearchResult searchRecords(
        String metricKey,
        String searchTerm
    ) {
        ObjectRecordSearchController.ObjectRecordSearchConfig config = getObjectConfig(
            metricKey
        );
        String normalizedSearchTerm = searchTerm?.trim();
        String likeSearchTerm = usesNameSearch(normalizedSearchTerm, config)
            ? '%' + normalizedSearchTerm + '%'
            : null;
        Map<String, Object> bindValues = new Map<String, Object>();
        if (likeSearchTerm != null) {
            bindValues.put('nameSearchTerm', likeSearchTerm);
        }
        String query = createSearchQuery(config, likeSearchTerm != null);

        List<ObjectRecordSearchController.ObjectRecordRow> rows = new List<ObjectRecordSearchController.ObjectRecordRow>();
        for (
            SObject record : Database.queryWithBinds(
                query,
                bindValues,
                AccessLevel.USER_MODE
            )
        ) {
            rows.add(
                new ObjectRecordSearchController.ObjectRecordRow(
                    record,
                    config.objectApiName,
                    config.nameFieldApiName
                )
            );
        }

        return new ObjectRecordSearchController.ObjectRecordSearchResult(
            config,
            rows,
            MAX_ROWS
        );
    }

    private String createSearchQuery(
        ObjectRecordSearchController.ObjectRecordSearchConfig config,
        Boolean includeNameSearch
    ) {
        String query =
            'SELECT Id, ' +
            config.nameFieldApiName +
            ', CreatedDate, LastModifiedDate FROM ' +
            config.objectApiName;

        if (includeNameSearch) {
            query +=
                ' WHERE ' +
                config.nameFieldApiName +
                ' LIKE :nameSearchTerm';
        }

        return query +
            ' ORDER BY LastModifiedDate DESC LIMIT ' +
            MAX_ROWS;
    }

    private Boolean usesNameSearch(
        String normalizedSearchTerm,
        ObjectRecordSearchController.ObjectRecordSearchConfig config
    ) {
        return String.isNotBlank(normalizedSearchTerm) && config.searchable;
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコードを削除します。
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    public virtual ObjectRecordSearchController.ObjectRecordDeleteResult deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        ObjectRecordSearchController.ObjectRecordSearchConfig config = getObjectConfig(
            metricKey
        );
        if (!config.deletable || recordIds == null || recordIds.isEmpty()) {
            return new ObjectRecordSearchController.ObjectRecordDeleteResult(
                recordIds == null ? 0 : recordIds.size(),
                0,
                new List<String>()
            );
        }

        List<SObject> recordsToDelete = queryRecordsById(
            config.objectApiName,
            new Set<Id>(recordIds)
        );
        Database.DeleteResult[] deleteResults = Database.delete(
            recordsToDelete,
            false,
            AccessLevel.USER_MODE
        );
        Integer deletedCount = 0;
        List<String> errors = new List<String>();

        for (Database.DeleteResult deleteResult : deleteResults) {
            if (deleteResult.isSuccess()) {
                deletedCount++;
                continue;
            }
            for (Database.Error deleteError : deleteResult.getErrors()) {
                errors.add(deleteError.getMessage());
            }
        }

        return new ObjectRecordSearchController.ObjectRecordDeleteResult(
            recordIds.size(),
            deletedCount,
            errors
        );
    }

    @SuppressWarnings('PMD.ApexSOQLInjection')
    private List<SObject> queryRecordsById(
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
                MAX_ROWS,
            new Map<String, Object>{ 'recordIds' => recordIds },
            AccessLevel.USER_MODE
        );
    }

    private ObjectMetricCatalog.MetricDefinition requireDefinition(
        String metricKey
    ) {
        ObjectMetricCatalog.MetricDefinition definition = ObjectMetricCatalog.getDefinition(
            metricKey
        );
        if (definition == null) {
            throw new ObjectRecordSearchException('未対応のオブジェクトです。');
        }
        return definition;
    }

    private Schema.DescribeSObjectResult requireObjectDescribe(
        ObjectMetricCatalog.MetricDefinition definition
    ) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(definition.objectApiName);
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

    private Schema.DescribeFieldResult requireNameFieldDescribe(
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
     * 汎用レコード検索の入力・権限検証エラーです。
     */
    public class ObjectRecordSearchException extends Exception {
    }
}
