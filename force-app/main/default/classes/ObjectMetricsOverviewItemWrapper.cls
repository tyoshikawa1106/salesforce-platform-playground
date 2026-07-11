/**
 * 1 つのオブジェクト件数カードを LWC に返す Wrapper
 */
public with sharing class ObjectMetricsOverviewItemWrapper {

    // LWC 側のカード設定と突き合わせるための安定したキー
    @AuraEnabled
    public String key { get; private set; }

    // 対象オブジェクト API 参照名
    @AuraEnabled
    public String objectApiName { get; private set; }

    // 画面表示ラベル
    @AuraEnabled
    public String label { get; private set; }

    // LWC 件数カードに表示する Lightning icon 名
    @AuraEnabled
    public String iconName { get; private set; }

    // 表示対象キーに対応する件数
    @AuraEnabled
    public Integer value { get; private set; }

    // 件数が表示上限に達したかどうかを示す
    @AuraEnabled
    public Boolean capped { get; private set; }

    /**
     * Selector の件数結果から LWC 用の件数項目を作成
     *
     * @param definition LWC 側のカード設定と対応するオブジェクト定義
     * @param metricCount 表示上限情報を含む件数結果
     */
    public ObjectMetricsOverviewItemWrapper(ObjectMetricCatalog.MetricDefinition definition, ObjectMetricsOverviewSelector.ObjectMetricCount metricCount) {
        // LWC 側のカード設定と突き合わせるキーを返す
        this.key = definition.key;
        // レコード一覧への遷移対象を特定できるようにする
        this.objectApiName = definition.objectApiName;
        // カードの見出しへ表示するラベルを返す
        this.label = definition.label;
        // カード上の Salesforce アイコンを指定できるようにする
        this.iconName = definition.iconName;
        // 件数が取れないカードもゼロ件として LWC に返す
        this.value = metricCount?.value ?? 0;
        // 上限到達状態を画面表示へ渡す
        this.capped = metricCount?.capped ?? false;
    }
}
