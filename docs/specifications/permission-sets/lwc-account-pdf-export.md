# LWC：取引先PDF出力

取引先PDF出力の利用に必要な画面アクセスと、取引先および出力項目の参照権限を付与します。

API 参照名　[LwcAccountPdfExport](../../../force-app/main/default/permissionsets/LwcAccountPdfExport.permissionset-meta.xml)

| 付与内容     | 対象                                              |
| ------------ | ------------------------------------------------- |
| Apex 実行    | `AccountPdfController`                            |
| 項目の参照   | 取引先：取引先番号（`Account.AccountNumber`）     |
| 項目の参照   | 取引先：住所(請求先)（`Account.BillingAddress`）  |
| 項目の参照   | 取引先：取引先 説明（`Account.Description`）      |
| 項目の参照   | 取引先：業種（`Account.Industry`）                |
| 項目の参照   | 取引先：取引先 電話（`Account.Phone`）            |
| 項目の参照   | 取引先：住所(納入先)（`Account.ShippingAddress`） |
| 項目の参照   | 取引先：取引先 種別（`Account.Type`）             |
| 項目の参照   | 取引先：Web サイト（`Account.Website`）           |
| オブジェクト | 取引先（参照）（`Account`）                       |
| Visualforce  | 取引先情報PDF（`AccountPdf`）                     |
