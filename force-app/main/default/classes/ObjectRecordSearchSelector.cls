/**
 * 汎用レコード検索画面で使う Salesforce レコードを問い合わせます。
 */
@SuppressWarnings('PMD.CyclomaticComplexity')
public virtual with sharing class ObjectRecordSearchSelector {
    private static final Integer PAGE_SIZE = 500;
    private static final Integer PAGE_FETCH_SIZE = PAGE_SIZE + 1;

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
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 500 件の検索結果
     */
    @SuppressWarnings('PMD.ApexSOQLInjection')
    public virtual ObjectRecordSearchController.ObjectRecordSearchResult searchRecords(
        ObjectRecordSearchController.ObjectRecordSearchRequest request
    ) {
        ObjectRecordSearchController.ObjectRecordSearchConfig config = getObjectConfig(
            request?.metricKey
        );
        PageCursor cursor = parsePageToken(request?.pageToken);
        String normalizedSearchTerm = request?.searchTerm?.trim();
        String likeSearchTerm = usesNameSearch(normalizedSearchTerm, config)
            ? '%' + normalizedSearchTerm + '%'
            : null;
        Map<String, Object> bindValues = new Map<String, Object>();
        if (likeSearchTerm != null) {
            bindValues.put('nameSearchTerm', likeSearchTerm);
        }
        if (cursor != null) {
            bindValues.put('cursorName', cursor.name);
            bindValues.put('cursorRecordId', cursor.recordId);
        }
        String query = createSearchQuery(config, likeSearchTerm != null, cursor);

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

        Boolean hasNextPage = rows.size() > PAGE_SIZE;
        if (hasNextPage) {
            rows.remove(PAGE_SIZE);
        }

        return new ObjectRecordSearchController.ObjectRecordSearchResult(
            config,
            rows,
            createPageState(
                normalizePageNumber(request?.pageNumber),
                hasNextPage ? createNextPageToken(rows) : null
            )
        );
    }

    private String createSearchQuery(
        ObjectRecordSearchController.ObjectRecordSearchConfig config,
        Boolean includeNameSearch,
        PageCursor cursor
    ) {
        String query =
            'SELECT Id, ' +
            config.nameFieldApiName +
            ', CreatedDate, LastModifiedDate FROM ' +
            config.objectApiName;

        List<String> whereClauses = new List<String>();
        if (includeNameSearch) {
            whereClauses.add(
                config.nameFieldApiName + ' LIKE :nameSearchTerm'
            );
        }
        if (cursor != null) {
            whereClauses.add(
                '(' +
                    config.nameFieldApiName +
                    ' > :cursorName OR (' +
                    config.nameFieldApiName +
                    ' = :cursorName AND Id > :cursorRecordId))'
            );
        }

        if (!whereClauses.isEmpty()) {
            query += ' WHERE ' + String.join(whereClauses, ' AND ');
        }

        return query +
            ' ORDER BY ' +
            config.nameFieldApiName +
            ' ASC, Id ASC LIMIT ' +
            PAGE_FETCH_SIZE;
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
                recordIds.size(),
            new Map<String, Object>{ 'recordIds' => recordIds },
            AccessLevel.USER_MODE
        );
    }

    private Integer normalizePageNumber(Integer pageNumber) {
        return pageNumber == null || pageNumber < 1 ? 1 : pageNumber;
    }

    private String createNextPageToken(
        List<ObjectRecordSearchController.ObjectRecordRow> rows
    ) {
        ObjectRecordSearchController.ObjectRecordRow lastRow = rows[
            rows.size() - 1
        ];
        return JSON.serialize(
            new Map<String, String>{
                'name' => lastRow.name,
                'recordId' => String.valueOf(lastRow.id)
            }
        );
    }

    private ObjectRecordSearchController.ObjectRecordSearchPageState createPageState(
        Integer pageNumber,
        String nextPageToken
    ) {
        ObjectRecordSearchController.ObjectRecordSearchPageState pageState = new ObjectRecordSearchController.ObjectRecordSearchPageState();
        pageState.pageSize = PAGE_SIZE;
        pageState.pageNumber = pageNumber;
        pageState.nextPageToken = nextPageToken;
        return pageState;
    }

    private PageCursor parsePageToken(String pageToken) {
        if (String.isBlank(pageToken)) {
            return null;
        }

        Map<String, Object> tokenParts = (Map<String, Object>) JSON.deserializeUntyped(
            pageToken
        );
        String cursorName = (String) tokenParts.get('name');
        String cursorRecordId = (String) tokenParts.get('recordId');
        if (String.isBlank(cursorName) || String.isBlank(cursorRecordId)) {
            throw new ObjectRecordSearchException(
                'ページ指定を読み込めません。'
            );
        }

        return new PageCursor(cursorName, (Id) cursorRecordId);
    }

    private class PageCursor {
        private final String name;
        private final Id recordId;

        private PageCursor(String name, Id recordId) {
            this.name = name;
            this.recordId = recordId;
        }
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
