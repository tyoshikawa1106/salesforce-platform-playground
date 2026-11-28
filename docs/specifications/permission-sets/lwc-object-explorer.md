# LWC：オブジェクトエクスプローラー

LWC：オブジェクトエクスプローラーの利用に必要な入口権限。取引先と取引先責任者の参照権限を付与します。

API 参照名　[LwcObjectExplorer](../../../force-app/main/default/permissionsets/LwcObjectExplorer.permissionset-meta.xml)

| 付与内容                       | 対象                                               |
| ------------------------------ | -------------------------------------------------- |
| Apex 実行                      | `ObjectExplorerController`                         |
| 外部ログイン情報のプリンシパル | `InternalSalesforceApi-SalesforceApiUserPrincipal` |
| オブジェクト                   | 取引先（参照）（`Account`）                        |
| オブジェクト                   | 取引先責任者（参照）（`Contact`）                  |
| タブ（表示）                   | オブジェクトエクスプローラー（`ObjectExplorer`）   |
| システム権限                   | API の有効化（`ApiEnabled`）                       |
| システム権限                   | データ分類を変更（`ModifyDataClassification`）     |
