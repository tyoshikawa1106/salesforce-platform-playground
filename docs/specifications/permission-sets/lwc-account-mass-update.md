# LWC：取引先一括更新

取引先一括更新画面を利用できます。取引先と業種・種別・評価の参照・編集権限、およびレコード移転権限を付与します。

API 参照名　[LwcAccountMassUpdate](../../../force-app/main/default/permissionsets/LwcAccountMassUpdate.permissionset-meta.xml)

| 付与内容         | 対象                                    |
| ---------------- | --------------------------------------- |
| Apex 実行        | `AccountMassUpdateController`           |
| 項目の参照・編集 | 取引先：業種（`Account.Industry`）      |
| 項目の参照・編集 | 取引先：取引先 評価（`Account.Rating`） |
| 項目の参照・編集 | 取引先：取引先 種別（`Account.Type`）   |
| オブジェクト     | 取引先（参照・編集）（`Account`）       |
| タブ（表示）     | 取引先一括更新（`AccountMassUpdate`）   |
| システム権限     | 所有権の移行（`TransferAnyEntity`）     |
