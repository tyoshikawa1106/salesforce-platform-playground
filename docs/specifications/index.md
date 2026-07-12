# 機能仕様

このディレクトリでは、リポジトリで独自実装した自動化、効率化、画面、連携などの開発機能について、現在の実装から確認できる仕様と仕組みを記録します。オブジェクト、項目、権限などの Salesforce 設定単体は仕様書を作成せず、開発機能が依存する範囲だけ関連する仕様書へ記載します。

ここにある文書は現行実装仕様です。現行実装の説明についてはリポジトリ内の実装を正としますが、承認済みの要求、業務ルール、外部契約を置き換えるものではありません。要求と実装の差異は、推測で解消せず各仕様書の「既知の差異・確認事項」に記録します。

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

現在、Aura、Visualforce、Apex Batch、Apex Scheduler、Apex 非同期処理、独立した API / 連携、イベント処理の対象実装はありません。
