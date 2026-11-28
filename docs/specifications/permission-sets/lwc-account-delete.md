# LWC：取引先一括削除

取引先一括削除の利用を許可します。取引先の参照・編集・削除権限を付与します。

API 参照名　[LwcAccountDelete](../../../force-app/main/default/permissionsets/LwcAccountDelete.permissionset-meta.xml)

| 付与内容     | 対象                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Apex 実行    | `AccountDeleteBatch`、`AccountDeleteBatchScheduler`、`AccountDeleteBatchSelector`、`AccountDeleteBatchService`、`AccountDeleteController`、`AccountDeleteSelector`、`AccountDeleteService`、`AccountDeleteWrapper`、`OrgEnvironment` |
| カスタム権限 | 取引先一括削除を実行（`RunAccountDelete`）                                                                                                                                                                                           |
| オブジェクト | 取引先（参照・編集・削除）（`Account`）                                                                                                                                                                                              |
| タブ（表示） | 取引先一括削除（`AccountDelete`）                                                                                                                                                                                                    |
