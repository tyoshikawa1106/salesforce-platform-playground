/**
 * 1 つのオブジェクト件数カードを LWC に返す Wrapper です。
 */
public with sharing class ObjectMetricsOverviewItemWrapper {
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
     * LWC 件数カードに表示する Lightning icon 名です。
     */
    @AuraEnabled
    public String iconName { get; private set; }

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
     * @param definition LWC 側のカード設定と対応するオブジェクト定義。
     * @param metricCount 表示上限情報を含む件数結果。
     */
    public ObjectMetricsOverviewItemWrapper(
        ObjectMetricCatalog.MetricDefinition definition,
        ObjectMetricsOverviewSelector.ObjectMetricCount metricCount
    ) {
        this.key = definition.key;
        this.objectApiName = definition.objectApiName;
        this.label = definition.label;
        this.iconName = definition.iconName;
        this.value = metricCount?.value ?? 0;
        this.capped = metricCount?.capped ?? false;
    }
}
