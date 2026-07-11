# Salesforce Settings の有効化状況

この文書は、`force-app/main/default/settings` に retrieve 済みの Settings から、`enable*`、`*enabled`、`isEnabled`、`active` 系の値を拾い、有効化/無効化の状態を分類したものです。

## 前提

- Settings の `false` は、必ずしも「今すぐ有効化すべき機能」ではありません。
- ライセンス、Edition、依存設定、不可逆性、セキュリティ影響により deploy できない、または有効化すべきでないものがあります。
- 実施する場合は、候補を小さく分けて `sf project deploy start --dry-run --source-dir ...` で確認してから反映します。
- `状態` は `force-app/main/default/settings` に retrieve 済みの値で、`true` を `有効`、`false` を `無効` として表記します。
- ネストされた設定は、`searchSettingsByObject[Account].enhancedLookupEnabled` のように対象名を角括弧で補足します。

## 分類一覧

| 分類                                                                                         | 件数 | 判断の目安                                        |
| -------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------- |
| [有効化候補](salesforce-settings-enable-status/enable-candidates.md)                         |  139 | 低リスクで、まず dry-run / 実 deploy を検討できる |
| [要依存確認](salesforce-settings-enable-status/dependency-review.md)                         |  365 | 関連機能、データモデル、権限、運用前提を確認する  |
| [ライセンス/製品依存注意](salesforce-settings-enable-status/license-product-dependencies.md) |  184 | Edition、追加ライセンス、製品契約を確認する       |
| [高リスク/個別判断](salesforce-settings-enable-status/high-risk-settings.md)                 |  806 | 不可逆性や組織全体への影響を個別に判断する        |
| [有効化対象外](salesforce-settings-enable-status/excluded-settings.md)                       |   12 | 有効化したい機能として扱わない                    |
