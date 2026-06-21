/**
 * データボード LWC に表示するレコード件数サマリを提供します。
 *
 * LWC から直接呼ばれる公開入口だけを持ち、集計順序や件数取得の詳細は
 * ObjectMetricsOverviewService / Selector に委譲します。
 */
public with sharing class ObjectMetricsOverviewController {
    /**
     * 現在のユーザーが参照できる各オブジェクトの件数を取得します。
     *
     * cacheable=true の読み取り専用メソッドとして LWC wire から利用します。
     * 内部例外は LWC に詳細を出さず、画面表示用の共通メッセージに変換します。
     * @return LWC 表示順に整列済みのレコード件数サマリ
     */
    @AuraEnabled(cacheable=true)
    public static ObjectMetricSummary getObjectMetrics() {
        try {
            return new ObjectMetricsOverviewService().getObjectMetrics();
        } catch (Exception error) {
            throw new AuraHandledException(
                'データボードを読み込めませんでした。'
            );
        }
    }

    /**
     * オブジェクト件数結果をまとめて返すレスポンス DTO です。
     *
     * LWC 側では metrics の順序をそのままカード表示順として扱います。
     */
    public class ObjectMetricSummary {
        /**
         * LWC に表示する順序付きの件数項目です。
         */
        @AuraEnabled
        public List<ObjectMetricItem> metrics { get; private set; }

        /**
         * 順序付き件数項目を保持するサマリを作成します。
         * @param metrics LWC に返す順序付き件数項目
         */
        public ObjectMetricSummary(List<ObjectMetricItem> metrics) {
            this.metrics = metrics;
        }
    }

    /**
     * 1 つのオブジェクト件数カードに対応する DTO です。
     */
    public class ObjectMetricItem {
        /**
         * LWC 側のカード設定と突き合わせるための安定したキーです。
         */
        @AuraEnabled
        public String key { get; private set; }

        /**
         * 対象オブジェクト API 参照名です。
         */
        @AuraEnabled
        public String objectApiName { get; private set; }

        /**
         * 画面表示ラベルです。
         */
        @AuraEnabled
        public String label { get; private set; }

        /**
         * 表示対象キーに対応する件数です。
         */
        @AuraEnabled
        public Integer value { get; private set; }

        /**
         * 件数が表示上限に達したかどうかを示します。
         */
        @AuraEnabled
        public Boolean capped { get; private set; }

        /**
         * Selector の件数結果から LWC 用の件数項目を作成します。
         *
         * 権限やクエリ都合で値が取れなかった場合でも、LWC が null を意識せず
         * 0 件として描画できるように既定値を補います。
         * @param definition LWC 側のカード設定と対応するオブジェクト定義
         * @param metricCount 表示上限情報を含む件数結果
         */
        public ObjectMetricItem(
            ObjectMetricCatalog.MetricDefinition definition,
            ObjectMetricsOverviewSelector.ObjectMetricCount metricCount
        ) {
            this.key = definition.key;
            this.objectApiName = definition.objectApiName;
            this.label = definition.label;
            this.value = metricCount?.value ?? 0;
            this.capped = metricCount?.capped ?? false;
        }
    }
}
