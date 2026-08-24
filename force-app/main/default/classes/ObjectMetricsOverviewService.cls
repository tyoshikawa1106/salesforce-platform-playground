/**
 * データボードで表示するオブジェクト件数の検証、集計、サマリ組み立て
 */
public with sharing class ObjectMetricsOverviewService {

    // 件数取得による負荷と画面表示値を最大 50,000 件へ制限
    private static final Integer MAX_DISPLAY_COUNT = 50000;
    // 同期 Apex の SOQL 上限に余裕を残す件数取得計画の最大数
    public static final Integer MAX_COUNT_QUERY_COUNT = 50;

    /**
     * 固定カタログから Selector へ渡す件数取得計画を作成
     *
     * @param definitions カタログ定義済みのオブジェクトメトリクス
     * @return カタログ順の件数取得計画
     * @throws IllegalArgumentException 計画数が明示上限を超える場合
     */
    public List<CountQuery> createCountQueries(
        List<ObjectMetricCatalog.MetricDefinition> definitions
    ) {
        // null の定義一覧は空の取得計画へ正規化
        List<ObjectMetricCatalog.MetricDefinition> safeDefinitions = definitions == null
            ? new List<ObjectMetricCatalog.MetricDefinition>()
            : definitions;
        // 固定カタログの肥大化による同期 SOQL 上限超過を実行前に拒否
        Integer definitionCount = safeDefinitions.size();
        if (definitionCount > MAX_COUNT_QUERY_COUNT) {
            throw new IllegalArgumentException(
                'オブジェクト件数の取得対象が上限を超えています。'
            );
        }
        // カタログ順の取得計画を保持する非 null の List を作成
        List<CountQuery> countQueries = new List<CountQuery>();
        // 許可リストと組織権限を検証した取得計画へ変換
        for (ObjectMetricCatalog.MetricDefinition definition : safeDefinitions) {
            // 定義に対応する利用者権限の件数 SOQL を作成
            String query = createCountQuery(definition);
            // 不正な定義はキーなしの空クエリとして安全に保持
            String metricKey = definition == null ? null : definition.key;
            // 未加工結果との対応を保つ件数取得計画を追加
            CountQuery countQuery = new CountQuery(metricKey, query);
            countQueries.add(countQuery);
        }
        // Coordinator がそのまま実行できる取得計画を返却
        return countQueries;
    }

    /**
     * カタログ定義と利用者権限から単一件数 SOQL を作成
     *
     * @param definition カタログ定義済みのオブジェクトメトリクス
     * @return 利用者権限で実行する件数 SOQL、取得対象外の場合は空文字
     */
    private String createCountQuery(ObjectMetricCatalog.MetricDefinition definition) {
        // カタログ外または組織に存在しない定義は SOQL 対象外にする
        Boolean isCatalogDefinition = definition != null &&
            ObjectMetricCatalog.hasObjectApiName(definition.objectApiName);
        if (!isCatalogDefinition) {
            return '';
        }
        // 許可済み API 名を組織の SObjectType へ解決
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(
            definition.objectApiName
        );
        // 組織に存在しないオブジェクトは SOQL 対象外にする
        if (sObjectType == null) {
            return '';
        }
        // 利用者の参照権限を判定する describe 結果を取得
        Schema.DescribeSObjectResult objectDescribe = sObjectType.getDescribe(
            SObjectDescribeOptions.DEFERRED
        );
        // 参照または問い合わせできないオブジェクトは SOQL 対象外にする
        Boolean isAccessible = objectDescribe.isAccessible();
        Boolean isQueryable = objectDescribe.isQueryable();
        if (!isAccessible || !isQueryable) {
            return '';
        }
        // User は有効ユーザーだけを件数対象にする
        String whereClause = definition.objectApiName == 'User'
            ? ' WHERE IsActive = TRUE'
            : '';
        // 表示上限で COUNT を止める利用者権限の SOQL を作成
        return 'SELECT COUNT() FROM ' +
            definition.objectApiName +
            whereClause +
            ' WITH USER_MODE LIMIT ' +
            MAX_DISPLAY_COUNT;
    }

    /**
     * 取得計画と未加工件数を表示上限付きメトリクス値へ集計
     *
     * @param countQueries カタログ順の件数取得計画
     * @param visibleRecordCounts Coordinator が返した未加工の件数
     * @return メトリクスキー別の表示上限付き件数
     */
    public Map<String, ObjectMetricCount> createMetricValues(
        List<CountQuery> countQueries,
        List<Integer> visibleRecordCounts
    ) {
        // null の取得計画は空の一覧へ正規化
        List<CountQuery> safeCountQueries = countQueries == null
            ? new List<CountQuery>()
            : countQueries;
        // null の取得結果は空の一覧へ正規化
        List<Integer> safeVisibleRecordCounts = visibleRecordCounts == null
            ? new List<Integer>()
            : visibleRecordCounts;
        // カタログ順の結果を保持する非 null の Map を作成
        Map<String, ObjectMetricCount> metricValues = new Map<String, ObjectMetricCount>();
        // 取得計画数を loop 条件の固定値として保持
        Integer countQueryCount = safeCountQueries.size();
        // 取得計画と同じ位置の未加工件数を表示値へ変換
        for (Integer index = 0; index < countQueryCount; index++) {
            // 現在位置の取得計画を参照
            CountQuery countQuery = safeCountQueries[index];
            // キーなしの不正な取得計画は集計対象外にする
            Boolean hasMetricKey = countQuery != null && String.isNotBlank(countQuery.metricKey);
            if (!hasMetricKey) {
                continue;
            }
            // 不足した取得結果はゼロ件へ正規化
            Integer visibleRecordCount = index < safeVisibleRecordCounts.size()
                ? safeVisibleRecordCounts[index]
                : 0;
            // 表示上限付きの件数をメトリクスキー別に保持
            ObjectMetricCount metricValue = createCount(visibleRecordCount);
            metricValues.put(countQuery.metricKey, metricValue);
        }
        // 画面サマリへ変換できる集計結果を返却
        return metricValues;
    }

    /**
     * 表示順を固定したオブジェクト件数サマリを作成
     *
     * @param metricValues 表示キー別の件数、キーは ObjectMetricCatalog の定義キーと対応
     * @return カタログ定義順に整列したオブジェクト件数サマリ
     */
    public ObjectMetricsOverviewSummaryWrapper createObjectMetrics(
        Map<String, ObjectMetricCount> metricValues
    ) {
        // null 入力でも全カードをゼロ件で返せるよう空 Map に正規化
        Map<String, ObjectMetricCount> safeMetricValues = metricValues == null
            ? new Map<String, ObjectMetricCount>()
            : metricValues;
        // カタログ定義順のカードを保持する非 null の List を作成
        List<ObjectMetricsOverviewItemWrapper> metricItems = new List<ObjectMetricsOverviewItemWrapper>();
        // 表示順を固定したカタログ定義を取得
        List<ObjectMetricCatalog.MetricDefinition> definitions = ObjectMetricCatalog.getDefinitions();
        // カタログ定義順を保って画面表示用カードを組み立て
        for (ObjectMetricCatalog.MetricDefinition definition : definitions) {
            // 定義キーに対応する上限処理済み件数を取得
            ObjectMetricCount metricValue = safeMetricValues.get(definition.key);
            // 定義と件数結果を 1 枚の LWC カードへ変換
            ObjectMetricsOverviewItemWrapper metricItem = new ObjectMetricsOverviewItemWrapper(
                definition,
                metricValue
            );
            // カタログ順の画面表示項目へ追加
            metricItems.add(metricItem);
        }
        // 全カードを含む画面表示用サマリを返却
        ObjectMetricsOverviewSummaryWrapper summary = new ObjectMetricsOverviewSummaryWrapper(
            metricItems
        );
        // カタログ順の画面表示用サマリを返却
        return summary;
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
        // 表示上限以上の件数を上限値と到達状態へ変換
        ObjectMetricCount metricCount = safeValue >= MAX_DISPLAY_COUNT
            ? new ObjectMetricCount(MAX_DISPLAY_COUNT, true)
            : new ObjectMetricCount(safeValue, false);
        // 上限処理済みの件数結果を返却
        return metricCount;
    }

    /**
     * 固定カタログのメトリクスキーと検証済み件数 SOQL の対応
     */
    public class CountQuery {

        /**
         * LWC 側のカードキー
         */
        public String metricKey { get; private set; }

        /**
         * 利用者権限で実行する検証済み件数 SOQL
         */
        public String query { get; private set; }

        private CountQuery(String metricKey, String query) {
            // 未加工結果を集計先へ対応付けるキーを保持
            this.metricKey = metricKey;
            // 許可リストと権限を検証済みの件数 SOQL を保持
            this.query = query;
        }
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
            // 画面へ返す上限処理済み件数を保持
            this.value = value;
            // 表示上限への到達状態を保持
            this.capped = capped;
        }
    }

}