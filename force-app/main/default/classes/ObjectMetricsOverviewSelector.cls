/**
 * オブジェクト件数一覧で使う件数問い合わせ
 */
public virtual with sharing class ObjectMetricsOverviewSelector {
    private static final Integer MAX_DISPLAY_COUNT = 50000;

    /**
     * 表示キーごとのオブジェクト件数取得
     *
     * @return オブジェクト件数一覧で使う表示キー別の件数
     */
    public virtual Map<String, ObjectMetricCount> getObjectMetricValues() {
        // カタログの表示キーごとに件数結果を返す
        Map<String, ObjectMetricCount> metricValues = new Map<String, ObjectMetricCount>();

        for (
            ObjectMetricCatalog.MetricDefinition definition : ObjectMetricCatalog.getDefinitions()
        ) {
            // 対象オブジェクトごとの参照権限を考慮して件数を取得
            metricValues.put(
                definition.key,
                countVisibleRecords(definition.objectApiName)
            );
        }

        return metricValues;
    }

    /**
     * 表示上限を考慮した件数結果を作成
     *
     * @param value 件数値
     * @return 表示上限に達した場合は capped を付けた件数結果
     */
    @TestVisible
    private static ObjectMetricCount createCount(Integer value) {
        // null 件数はゼロとして扱い画面表示を安定化
        Integer safeValue = value ?? 0;
        return safeValue >= MAX_DISPLAY_COUNT
            ? createCappedCount()
            : new ObjectMetricCount(safeValue, false);
    }

    /**
     * 表示上限に達した件数結果を作成
     * @return capped を付けた件数結果
     */
    private static ObjectMetricCount createCappedCount() {
        return new ObjectMetricCount(MAX_DISPLAY_COUNT, true);
    }

    @TestVisible
    @SuppressWarnings('PMD.ApexSOQLInjection')
    private ObjectMetricCount countVisibleRecords(String objectApiName) {
        // カタログ外または参照不可のオブジェクトはゼロ件として扱う
        if (
            String.isBlank(objectApiName) ||
            !ObjectMetricCatalog.hasObjectApiName(objectApiName) ||
            !isObjectAccessible(objectApiName)
        ) {
            return toObjectMetricCount(0);
        }
        // User は有効ユーザーだけを件数対象にする
        String whereClause = objectApiName == 'User'
            ? ' WHERE IsActive = TRUE'
            : '';
        // 表示上限で COUNT を止めて大規模データでも応答を安定化
        String query =
            'SELECT COUNT() FROM ' +
            objectApiName +
            whereClause +
            ' WITH USER_MODE LIMIT ' +
            MAX_DISPLAY_COUNT;

        try {
            return toObjectMetricCount(Database.countQuery(query));
        } catch (QueryException queryException) {
            // 件数取得できない標準オブジェクトは画面表示を止めずゼロ件にする
            return toObjectMetricCount(0);
        }
    }

    private Boolean isObjectAccessible(String objectApiName) {
        // ユーザーが参照できるオブジェクトだけ件数取得対象にする
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(objectApiName);
        return sObjectType != null &&
            sObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
                .isAccessible();
    }

    private ObjectMetricCount toObjectMetricCount(Integer value) {
        return createCount(value);
    }

    /**
     * 表示上限情報を含む件数結果
     */
    public class ObjectMetricCount {
        /**
         * 表示上限で丸めた件数値
         */
        public Integer value { get; private set; }

        /**
         * 件数が表示上限に達したかどうかを示す
         */
        public Boolean capped { get; private set; }

        /**
         * 表示用に上限処理済みの件数を作成
         *
         * @param value 表示用に上限処理済みの件数値
         * @param capped 件数が表示上限に達したかどうか
         */
        private ObjectMetricCount(Integer value, Boolean capped) {
            this.value = value;
            this.capped = capped;
        }
    }
}
