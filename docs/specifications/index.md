# 機能仕様

このディレクトリでは、リポジトリで開発、管理している機能について、現在の実装に対応する仕様と仕組みを記録します。

仕様書の追加、更新、分割は [機能仕様書ルール](../development/specification-rules.md) に従います。

## 仕様書の一覧

| 種別         | 機能                         | 主なメタデータ                              | 仕様書                                                                  |
| ------------ | ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Flow         | 顧客満足度アンケート         | `customer_satisfaction`                     | [顧客満足度アンケート](flows/customer-satisfaction/index.md)            |
| Flow         | 推奨度アンケート（NPS）      | `net_promoter_score`                        | [推奨度アンケート（NPS）](flows/net-promoter-score/index.md)            |
| Flow         | レポートエクスポート保護判定 | `sfdc_default_ReportExport_Protection_Flow` | [レポートエクスポート保護判定](flows/report-export-protection/index.md) |
| LWC          | データボード                 | `objectMetricsOverview`                     | [データボード](lwc/object-metrics-overview/index.md)                    |
| LWC          | 汎用レコード検索             | `objectRecordSearch`                        | [汎用レコード検索](lwc/object-record-search/index.md)                   |
| Apex Trigger | 取引先トリガー               | `AccountTrigger`                            | [取引先トリガー](apex/triggers/account-trigger/index.md)                |

現在、Aura、Visualforce、Apex Batch、Apex Scheduler の対象実装はありません。
