# LWC：取引先データ品質スキャン

取引先データ品質スキャンの開始、進捗確認、集計結果参照に必要な最小権限。

API 参照名　[LwcAccountDataQualityScan](../../../force-app/main/default/permissionsets/LwcAccountDataQualityScan.permissionset-meta.xml)

| 付与内容         | 対象                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apex 実行        | `AccountDataQualityScanController`、`AccountDataQualityScanQueueable`、`AccountDataQualityScanSelector`、`AccountDataQualityScanService`、`AccountDataQualityScanWrapper` |
| 項目の参照       | 取引先：取引先番号（`Account.AccountNumber`）                                                                                                                             |
| 項目の参照       | 取引先：住所(請求先)（`Account.BillingAddress`）                                                                                                                          |
| 項目の参照       | 取引先：業種（`Account.Industry`）                                                                                                                                        |
| 項目の参照       | 取引先：取引先 電話（`Account.Phone`）                                                                                                                                    |
| 項目の参照       | 取引先：Web サイト（`Account.Website`）                                                                                                                                   |
| 項目の参照・編集 | データ品質スキャン：実行中キー（`DataQualityScan__c.Active_Key__c`）                                                                                                      |
| 項目の参照・編集 | データ品質スキャン：終了日時（`DataQualityScan__c.Completed_At__c`）                                                                                                      |
| 項目の参照・編集 | データ品質スキャン：最終エラー（`DataQualityScan__c.Error_Message__c`）                                                                                                   |
| 項目の参照・編集 | データ品質スキャン：取引先番号なし件数（`DataQualityScan__c.Missing_Account_Number_Count__c`）                                                                            |
| 項目の参照・編集 | データ品質スキャン：請求先住所不足件数（`DataQualityScan__c.Missing_Address_Count__c`）                                                                                   |
| 項目の参照・編集 | データ品質スキャン：業種なし件数（`DataQualityScan__c.Missing_Industry_Count__c`）                                                                                        |
| 項目の参照・編集 | データ品質スキャン：電話番号なし件数（`DataQualityScan__c.Missing_Phone_Count__c`）                                                                                       |
| 項目の参照・編集 | データ品質スキャン：Webサイトなし件数（`DataQualityScan__c.Missing_Website_Count__c`）                                                                                    |
| 項目の参照・編集 | データ品質スキャン：処理済み件数（`DataQualityScan__c.Processed_Count__c`）                                                                                               |
| 項目の参照・編集 | データ品質スキャン：実行要求者（`DataQualityScan__c.Requested_By__c`）                                                                                                    |
| 項目の参照・編集 | データ品質スキャン：開始日時（`DataQualityScan__c.Started_At__c`）                                                                                                        |
| 項目の参照・編集 | データ品質スキャン：ステータス（`DataQualityScan__c.Status__c`）                                                                                                          |
| 項目の参照・編集 | データ品質スキャン：対象オブジェクト（`DataQualityScan__c.Target_Object__c`）                                                                                             |
| 項目の参照・編集 | データ品質スキャン：対象総件数（`DataQualityScan__c.Total_Count__c`）                                                                                                     |
| オブジェクト     | 取引先（参照）（`Account`）                                                                                                                                               |
| オブジェクト     | 取引先責任者（参照）（`Contact`）                                                                                                                                         |
| オブジェクト     | データ品質スキャン（参照・作成・編集）（`DataQualityScan__c`）                                                                                                            |
