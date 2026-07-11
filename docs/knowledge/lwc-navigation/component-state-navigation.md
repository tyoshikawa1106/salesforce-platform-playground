# コンポーネント内の画面切り替え

[LWC の画面遷移](../lwc-navigation.md)に戻る。

## コンポーネント内で切り替える

親 LWC が状態を持ち、表示する子コンポーネントを切り替える方法です。

```text
<template>
    <template lwc:if={selectedMetricKey}>
        <c-object-record-search
            metric-key={selectedMetricKey}
            onback={handleBack}
        ></c-object-record-search>
    </template>
    <template lwc:else>
        <c-object-metrics-dashboard
            onselect={handleSelect}
        ></c-object-metrics-dashboard>
    </template>
</template>
```

```js
handleSelect(event) {
    this.selectedMetricKey = event.detail.metricKey;
}

handleBack() {
    this.selectedMetricKey = undefined;
}
```

この方法は軽く、同じ画面内の詳細表示や一覧切り替えに向いています。一方で URL は基本的に変わらないため、表示状態を直接共有したり、ブラウザの戻るで画面状態を戻したりする用途には向きません。
