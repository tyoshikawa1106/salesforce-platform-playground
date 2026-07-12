# 機能仕様

このディレクトリでは、リポジトリで開発、管理している機能について、現在の実装に対応する仕様と仕組みを記録します。

主仕様書は、処理の入口となるメタデータを単位にします。LWC、Aura、Visualforce の仕様書には、その機能を支える Apex Controller、Service、Selector などの処理も含めます。主仕様書が大きくなる場合は、利用者から見て独立した処理ごとに詳細仕様を分割します。

## 仕様書の一覧

| 種別         | 機能                         | 主なメタデータ                              | 仕様書                                                                  |
| ------------ | ---------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Flow         | Customer Satisfaction        | `customer_satisfaction`                     | [Customer Satisfaction](flows/customer-satisfaction/index.md)           |
| Flow         | Net Promoter Score           | `net_promoter_score`                        | [Net Promoter Score](flows/net-promoter-score/index.md)                 |
| Flow         | レポートエクスポート保護判定 | `sfdc_default_ReportExport_Protection_Flow` | [レポートエクスポート保護判定](flows/report-export-protection/index.md) |
| LWC          | データボード                 | `objectMetricsOverview`                     | [データボード](lwc/object-metrics-overview/index.md)                    |
| LWC          | 汎用レコード検索             | `objectRecordSearch`                        | [汎用レコード検索](lwc/object-record-search/index.md)                   |
| Apex Trigger | Account Trigger              | `AccountTrigger`                            | [AccountTrigger](apex/triggers/account-trigger/index.md)                |

現在、Aura、Visualforce、Apex Batch、Apex Scheduler の対象実装はありません。

## 記載方針

- 実装から確認できる現在の振る舞いを記載します。
- 実装予定、検討中の内容、判断過程は仕様として固定せず、必要に応じて `docs/discussions/` に記録します。
- Salesforce や開発技術に関する汎用的な説明は `docs/knowledge/` に記録します。
- 実装を変更した場合は、関連する仕様書も同じ変更で更新します。
- 主仕様書は対象ごとのディレクトリに `index.md` として配置し、詳細仕様は同じディレクトリに追加します。
- 新しい主仕様書は [機能仕様書テンプレート](template.md) を基準に作成します。
- 詳細仕様には対象のユースケースを説明するために必要な見出しだけを設け、主仕様書と同じ説明を重複させません。
