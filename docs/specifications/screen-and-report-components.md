# 画面・帳票の構成一覧

Salesforce上で使う画面・帳票について、機能別の入口、LWC、補助JavaScript、Apex本体と同名Testの対応をまとめます。実装の正本はリンク先のソースです。入力、権限、エラー、非同期処理の詳細は各機能の仕様書を参照してください。

機能内の子LWCやLogicは独立した利用機能として数えません。Apexの内部クラスは所属する本体クラスの同名Testで扱い、独立したテストクラスへ分けません。

## 機能の入口

| 機能・仕様書                                                        | 入口                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| [取引先データ品質スキャン](lwc/account-data-quality-scan/index.md)  | `accountDataQualityScan`                                |
| [データボード](lwc/object-metrics-overview/index.md)                | `objectMetricsOverview`                                 |
| [汎用レコード検索](lwc/object-record-search/index.md)               | `objectRecordSearch`                                    |
| [ケース取引先責任者プロフィール](lwc/case-contact-profile/index.md) | `caseContactProfile`                                    |
| [最近の問い合わせ](lwc/case-related-case-list/index.md)             | `caseRelatedCaseList`                                   |
| [ケースメールメッセージ一覧](lwc/case-email-message-list/index.md)  | `caseEmailMessageList`                                  |
| [取引先一括削除](lwc/account-delete/index.md)                       | `accountDelete`                                         |
| [テストデータ一括削除](lwc/test-data-delete/index.md)               | `testDataDelete`                                        |
| [取引先一括更新](lwc/account-mass-update/index.md)                  | `accountMassUpdate`                                     |
| [組織エクスプローラー](lwc/org-explorer/index.md)                   | `orgExplorer`                                           |
| [オブジェクトエクスプローラー](lwc/object-explorer/index.md)        | `objectExplorer`                                        |
| [取引先情報PDF](visualforce/account-pdf/index.md)                   | `Account.PdfExport` → `accountPdfExport` → `AccountPdf` |

## 機能別の構成

### 取引先データ品質スキャン

仕様・配置・権限: [取引先データ品質スキャン](lwc/account-data-quality-scan/index.md)。

| LWC                                                                                                         | 同Bundleの補助JavaScript                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [accountDataQualityScan](../../force-app/main/default/lwc/accountDataQualityScan/accountDataQualityScan.js) | [accountDataQualityScanLogic.js](../../force-app/main/default/lwc/accountDataQualityScan/accountDataQualityScanLogic.js) |

| Apex本体                                                                                                      | 役割                                                     | 同名Test                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [AccountDataQualityScanController](../../force-app/main/default/classes/AccountDataQualityScanController.cls) | 取引先データ品質スキャンLWCのApex入口                    | [AccountDataQualityScanControllerTest](../../force-app/main/default/classes/AccountDataQualityScanControllerTest.cls) |
| [AccountDataQualityScanQueueable](../../force-app/main/default/classes/AccountDataQualityScanQueueable.cls)   | Cursorを分割取得して取引先データ品質を集計する非同期処理 | [AccountDataQualityScanQueueableTest](../../force-app/main/default/classes/AccountDataQualityScanQueueableTest.cls)   |
| [AccountDataQualityScanSelector](../../force-app/main/default/classes/AccountDataQualityScanSelector.cls)     | 取引先Cursorとスキャン管理レコードのデータアクセス       | [AccountDataQualityScanSelectorTest](../../force-app/main/default/classes/AccountDataQualityScanSelectorTest.cls)     |
| [AccountDataQualityScanService](../../force-app/main/default/classes/AccountDataQualityScanService.cls)       | 取引先データ品質の判定とスキャン状態遷移                 | [AccountDataQualityScanServiceTest](../../force-app/main/default/classes/AccountDataQualityScanServiceTest.cls)       |
| [AccountDataQualityScanWrapper](../../force-app/main/default/classes/AccountDataQualityScanWrapper.cls)       | 取引先データ品質スキャンの画面表示値                     | [AccountDataQualityScanWrapperTest](../../force-app/main/default/classes/AccountDataQualityScanWrapperTest.cls)       |

### データボード

仕様・配置・権限: [データボード](lwc/object-metrics-overview/index.md)。

| LWC                                                                                                      | 同Bundleの補助JavaScript                                                                                              |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [objectMetricsOverview](../../force-app/main/default/lwc/objectMetricsOverview/objectMetricsOverview.js) | [objectMetricsOverviewLogic.js](../../force-app/main/default/lwc/objectMetricsOverview/objectMetricsOverviewLogic.js) |

| Apex本体                                                                                                            | 役割                                                               | 同名Test                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [ObjectMetricsOverviewController](../../force-app/main/default/classes/ObjectMetricsOverviewController.cls)         | データボード LWC に表示するレコード件数サマリ提供                  | [ObjectMetricsOverviewControllerTest](../../force-app/main/default/classes/ObjectMetricsOverviewControllerTest.cls)         |
| [ObjectMetricsOverviewItemWrapper](../../force-app/main/default/classes/ObjectMetricsOverviewItemWrapper.cls)       | 1 つのオブジェクト件数カードを LWC に返す Wrapper                  | [ObjectMetricsOverviewItemWrapperTest](../../force-app/main/default/classes/ObjectMetricsOverviewItemWrapperTest.cls)       |
| [ObjectMetricsOverviewQueryRunner](../../force-app/main/default/classes/ObjectMetricsOverviewQueryRunner.cls)       | 固定カタログに含まれる異なる SObject の件数問い合わせを調整        | [ObjectMetricsOverviewQueryRunnerTest](../../force-app/main/default/classes/ObjectMetricsOverviewQueryRunnerTest.cls)       |
| [ObjectMetricsOverviewSelector](../../force-app/main/default/classes/ObjectMetricsOverviewSelector.cls)             | オブジェクト件数一覧で使う件数 SOQL の実行                         | [ObjectMetricsOverviewSelectorTest](../../force-app/main/default/classes/ObjectMetricsOverviewSelectorTest.cls)             |
| [ObjectMetricsOverviewService](../../force-app/main/default/classes/ObjectMetricsOverviewService.cls)               | データボードで表示するオブジェクト件数の検証、集計、サマリ組み立て | [ObjectMetricsOverviewServiceTest](../../force-app/main/default/classes/ObjectMetricsOverviewServiceTest.cls)               |
| [ObjectMetricsOverviewSummaryWrapper](../../force-app/main/default/classes/ObjectMetricsOverviewSummaryWrapper.cls) | オブジェクト件数結果を LWC に返す Wrapper                          | [ObjectMetricsOverviewSummaryWrapperTest](../../force-app/main/default/classes/ObjectMetricsOverviewSummaryWrapperTest.cls) |

`ObjectMetricCatalog`を汎用レコード検索と共有します。カード選択後は`objectRecordSearch`を組み込んで表示し、検索・編集・削除のApex構成は[汎用レコード検索](lwc/object-record-search/index.md)へ委譲します。

### 汎用レコード検索

仕様・配置・権限: [汎用レコード検索](lwc/object-record-search/index.md)。

| LWC                                                                                                      | 同Bundleの補助JavaScript                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [objectRecordSearch](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearch.js)          | [objectRecordSearchDisplay.js](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchDisplay.js)、[objectRecordSearchForm.js](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchForm.js)、[objectRecordSearchFormPolicy.js](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchFormPolicy.js)、[objectRecordSearchLogic.js](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchLogic.js)、[objectRecordSearchState.js](../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchState.js) |
| [objectRecordFormModal](../../force-app/main/default/lwc/objectRecordFormModal/objectRecordFormModal.js) | [objectRecordFormModalLogic.js](../../force-app/main/default/lwc/objectRecordFormModal/objectRecordFormModalLogic.js)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

| Apex本体                                                                                                      | 役割                                                       | 同名Test                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [ObjectRecordSearchConfigWrapper](../../force-app/main/default/classes/ObjectRecordSearchConfigWrapper.cls)   | 汎用レコード検索画面の設定を LWC に返す Wrapper            | [ObjectRecordSearchConfigWrapperTest](../../force-app/main/default/classes/ObjectRecordSearchConfigWrapperTest.cls)   |
| [ObjectRecordSearchContext](../../force-app/main/default/classes/ObjectRecordSearchContext.cls)               | 汎用レコード検索の Apex 内部処理で共有する状態             | [ObjectRecordSearchContextTest](../../force-app/main/default/classes/ObjectRecordSearchContextTest.cls)               |
| [ObjectRecordSearchController](../../force-app/main/default/classes/ObjectRecordSearchController.cls)         | データボードから遷移する汎用レコード検索画面の Apex 入口   | [ObjectRecordSearchControllerTest](../../force-app/main/default/classes/ObjectRecordSearchControllerTest.cls)         |
| [ObjectRecordSearchDeleteWrapper](../../force-app/main/default/classes/ObjectRecordSearchDeleteWrapper.cls)   | 汎用レコード検索画面に返す削除結果 Wrapper                 | [ObjectRecordSearchDeleteWrapperTest](../../force-app/main/default/classes/ObjectRecordSearchDeleteWrapperTest.cls)   |
| [ObjectRecordSearchFieldCatalog](../../force-app/main/default/classes/ObjectRecordSearchFieldCatalog.cls)     | 汎用レコード検索の一覧に追加表示する固定項目管理           | [ObjectRecordSearchFieldCatalogTest](../../force-app/main/default/classes/ObjectRecordSearchFieldCatalogTest.cls)     |
| [ObjectRecordSearchFieldWrapper](../../force-app/main/default/classes/ObjectRecordSearchFieldWrapper.cls)     | 汎用レコード検索画面の一覧に表示する固定項目の Wrapper     | [ObjectRecordSearchFieldWrapperTest](../../force-app/main/default/classes/ObjectRecordSearchFieldWrapperTest.cls)     |
| [ObjectRecordSearchQueryPlan](../../force-app/main/default/classes/ObjectRecordSearchQueryPlan.cls)           | 汎用レコード検索で共有する問い合わせ条件の保持と検証       | [ObjectRecordSearchQueryPlanTest](../../force-app/main/default/classes/ObjectRecordSearchQueryPlanTest.cls)           |
| [ObjectRecordSearchRequestWrapper](../../force-app/main/default/classes/ObjectRecordSearchRequestWrapper.cls) | 汎用レコード検索画面から Apex に渡す検索リクエスト Wrapper | [ObjectRecordSearchRequestWrapperTest](../../force-app/main/default/classes/ObjectRecordSearchRequestWrapperTest.cls) |
| [ObjectRecordSearchResultWrapper](../../force-app/main/default/classes/ObjectRecordSearchResultWrapper.cls)   | 汎用レコード検索画面に返す検索結果 Wrapper                 | [ObjectRecordSearchResultWrapperTest](../../force-app/main/default/classes/ObjectRecordSearchResultWrapperTest.cls)   |
| [ObjectRecordSearchRowWrapper](../../force-app/main/default/classes/ObjectRecordSearchRowWrapper.cls)         | 汎用レコード検索画面の一覧行 Wrapper                       | [ObjectRecordSearchRowWrapperTest](../../force-app/main/default/classes/ObjectRecordSearchRowWrapperTest.cls)         |
| [ObjectRecordSearchSelector](../../force-app/main/default/classes/ObjectRecordSearchSelector.cls)             | 汎用レコード検索画面で使う Salesforce レコード問い合わせ   | [ObjectRecordSearchSelectorTest](../../force-app/main/default/classes/ObjectRecordSearchSelectorTest.cls)             |
| [ObjectRecordSearchService](../../force-app/main/default/classes/ObjectRecordSearchService.cls)               | 汎用レコード検索画面の判定と Wrapper 組み立て提供          | [ObjectRecordSearchServiceTest](../../force-app/main/default/classes/ObjectRecordSearchServiceTest.cls)               |
| [ObjectRecordSearchSortSupport](../../force-app/main/default/classes/ObjectRecordSearchSortSupport.cls)       | 汎用レコード検索のソート条件とページングカーソル取り扱い   | [ObjectRecordSearchSortSupportTest](../../force-app/main/default/classes/ObjectRecordSearchSortSupportTest.cls)       |

`ObjectMetricCatalog`をデータボードと共有します。`objectRecordFormModal`はこの機能専用の内部表示部品です。

### ケース取引先責任者プロフィール

仕様・配置・権限: [ケース取引先責任者プロフィール](lwc/case-contact-profile/index.md)。

| LWC                                                                                             | 同Bundleの補助JavaScript                                                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [caseContactProfile](../../force-app/main/default/lwc/caseContactProfile/caseContactProfile.js) | [caseContactProfileLogic.js](../../force-app/main/default/lwc/caseContactProfile/caseContactProfileLogic.js) |

専用Apexはありません。`lightning/uiRecordApi`と`lightning/uiRelatedListApi`で取得し、表示モデルは同BundleのLogicで生成します。

### 最近の問い合わせ

仕様・配置・権限: [最近の問い合わせ](lwc/case-related-case-list/index.md)。

| LWC                                                                                                | 同Bundleの補助JavaScript                                                                                        |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [caseRelatedCaseList](../../force-app/main/default/lwc/caseRelatedCaseList/caseRelatedCaseList.js) | [caseRelatedCaseListLogic.js](../../force-app/main/default/lwc/caseRelatedCaseList/caseRelatedCaseListLogic.js) |

専用Apexはありません。`lightning/uiRecordApi`と`lightning/uiRelatedListApi`で取得し、表示モデルは同BundleのLogicで生成します。

### ケースメールメッセージ一覧

仕様・配置・権限: [ケースメールメッセージ一覧](lwc/case-email-message-list/index.md)。

| LWC                                                                                                   | 同Bundleの補助JavaScript                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [caseEmailMessageList](../../force-app/main/default/lwc/caseEmailMessageList/caseEmailMessageList.js) | [caseEmailMessageListLogic.js](../../force-app/main/default/lwc/caseEmailMessageList/caseEmailMessageListLogic.js) |

| Apex本体                                                                                            | 役割                                               | 同名Test                                                                                                    |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [CaseEmailMessageController](../../force-app/main/default/classes/CaseEmailMessageController.cls)   | ケースに紐づくメールメッセージ一覧の Apex 入口     | [CaseEmailMessageControllerTest](../../force-app/main/default/classes/CaseEmailMessageControllerTest.cls)   |
| [CaseEmailMessagePageWrapper](../../force-app/main/default/classes/CaseEmailMessagePageWrapper.cls) | ケースメールメッセージ一覧に返すページ情報 Wrapper | [CaseEmailMessagePageWrapperTest](../../force-app/main/default/classes/CaseEmailMessagePageWrapperTest.cls) |
| [CaseEmailMessageSelector](../../force-app/main/default/classes/CaseEmailMessageSelector.cls)       | ケースに紐づくメールメッセージ問い合わせ           | [CaseEmailMessageSelectorTest](../../force-app/main/default/classes/CaseEmailMessageSelectorTest.cls)       |
| [CaseEmailMessageService](../../force-app/main/default/classes/CaseEmailMessageService.cls)         | ケースメールメッセージ一覧の入力値検証             | [CaseEmailMessageServiceTest](../../force-app/main/default/classes/CaseEmailMessageServiceTest.cls)         |

### 取引先一括削除

仕様・配置・権限: [取引先一括削除](lwc/account-delete/index.md)。

| LWC                                                                                                   | 同Bundleの補助JavaScript                                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [accountDelete](../../force-app/main/default/lwc/accountDelete/accountDelete.js)                      | [accountDeleteLogic.js](../../force-app/main/default/lwc/accountDelete/accountDeleteLogic.js) |
| [accountDeleteConfirm](../../force-app/main/default/lwc/accountDeleteConfirm/accountDeleteConfirm.js) | なし（メインJavaScriptに実装）                                                                |

| Apex本体                                                                                            | 役割                                                       | 同名Test                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [AccountDeleteBatch](../../force-app/main/default/classes/AccountDeleteBatch.cls)                   | 参照可能な取引先を分割削除し、確定件数をfinishまで保持する | [AccountDeleteBatchTest](../../force-app/main/default/classes/AccountDeleteBatchTest.cls)                   |
| [AccountDeleteBatchScheduler](../../force-app/main/default/classes/AccountDeleteBatchScheduler.cls) | 登録ユーザーの権限で取引先削除バッチを定期起動             | [AccountDeleteBatchSchedulerTest](../../force-app/main/default/classes/AccountDeleteBatchSchedulerTest.cls) |
| [AccountDeleteBatchSelector](../../force-app/main/default/classes/AccountDeleteBatchSelector.cls)   | 取引先削除の対象と標準バッチジョブを検索                   | [AccountDeleteBatchSelectorTest](../../force-app/main/default/classes/AccountDeleteBatchSelectorTest.cls)   |
| [AccountDeleteBatchService](../../force-app/main/default/classes/AccountDeleteBatchService.cls)     | 取引先削除の実行条件判定、件数集計、実行者への通知を行う   | [AccountDeleteBatchServiceTest](../../force-app/main/default/classes/AccountDeleteBatchServiceTest.cls)     |
| [AccountDeleteBatchWrapper](../../force-app/main/default/classes/AccountDeleteBatchWrapper.cls)     | バッチが引き継ぐ取引先削除の集計結果                       | [AccountDeleteBatchWrapperTest](../../force-app/main/default/classes/AccountDeleteBatchWrapperTest.cls)     |
| [AccountDeleteController](../../force-app/main/default/classes/AccountDeleteController.cls)         | 取引先一括削除画面の入口                                   | [AccountDeleteControllerTest](../../force-app/main/default/classes/AccountDeleteControllerTest.cls)         |
| [AccountDeleteSelector](../../force-app/main/default/classes/AccountDeleteSelector.cls)             | 画面に表示する実行者自身の標準ジョブを検索                 | [AccountDeleteSelectorTest](../../force-app/main/default/classes/AccountDeleteSelectorTest.cls)             |
| [AccountDeleteService](../../force-app/main/default/classes/AccountDeleteService.cls)               | 画面の実行可否判定と受付応答を生成                         | [AccountDeleteServiceTest](../../force-app/main/default/classes/AccountDeleteServiceTest.cls)               |
| [AccountDeleteWrapper](../../force-app/main/default/classes/AccountDeleteWrapper.cls)               | 画面に返す受付結果と標準ジョブの状態                       | [AccountDeleteWrapperTest](../../force-app/main/default/classes/AccountDeleteWrapperTest.cls)               |

画面から起動する[削除バッチ](apex/batches/account-delete/index.md)と、別の起動入口を持つ[定期削除](apex/schedulers/account-delete/index.md)も併記しています。画面ServiceとバッチServiceは別責務で、環境判定だけを`OrgEnvironment`で共有します。

### テストデータ一括削除

仕様・配置・権限: [テストデータ一括削除](lwc/test-data-delete/index.md)。

| LWC                                                                                 | 同Bundleの補助JavaScript                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [testDataDelete](../../force-app/main/default/lwc/testDataDelete/testDataDelete.js) | [testDataDeleteLogic.js](../../force-app/main/default/lwc/testDataDelete/testDataDeleteLogic.js) |

| Apex本体                                                                                            | 役割                                                             | 同名Test                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [TestDataDeleteBatch](../../force-app/main/default/classes/TestDataDeleteBatch.cls)                 | 対象オブジェクト全件を子から親へ直列削除                         | [TestDataDeleteBatchTest](../../force-app/main/default/classes/TestDataDeleteBatchTest.cls)                 |
| [TestDataDeleteBatchSelector](../../force-app/main/default/classes/TestDataDeleteBatchSelector.cls) | バッチの実効権限、削除対象、標準ジョブを取得                     | [TestDataDeleteBatchSelectorTest](../../force-app/main/default/classes/TestDataDeleteBatchSelectorTest.cls) |
| [TestDataDeleteBatchService](../../force-app/main/default/classes/TestDataDeleteBatchService.cls)   | オブジェクト単位の削除可否、結果集計、次の処理への継続条件を判定 | [TestDataDeleteBatchServiceTest](../../force-app/main/default/classes/TestDataDeleteBatchServiceTest.cls)   |
| [TestDataDeleteBatchWrapper](../../force-app/main/default/classes/TestDataDeleteBatchWrapper.cls)   | テストデータ削除の固定対象とバッチ間で受け渡す集計値             | [TestDataDeleteBatchWrapperTest](../../force-app/main/default/classes/TestDataDeleteBatchWrapperTest.cls)   |
| [TestDataDeleteController](../../force-app/main/default/classes/TestDataDeleteController.cls)       | テストデータ一括削除画面の参照と実行受付                         | [TestDataDeleteControllerTest](../../force-app/main/default/classes/TestDataDeleteControllerTest.cls)       |
| [TestDataDeleteSelector](../../force-app/main/default/classes/TestDataDeleteSelector.cls)           | 削除画面の実効権限、残件数、標準ジョブを検索                     | [TestDataDeleteSelectorTest](../../force-app/main/default/classes/TestDataDeleteSelectorTest.cls)           |
| [TestDataDeleteService](../../force-app/main/default/classes/TestDataDeleteService.cls)             | テストデータ削除の共通定義・実行条件と画面応答                   | [TestDataDeleteServiceTest](../../force-app/main/default/classes/TestDataDeleteServiceTest.cls)             |
| [TestDataDeleteWrapper](../../force-app/main/default/classes/TestDataDeleteWrapper.cls)             | 削除画面に返す実行条件、対象一覧、残件数、標準ジョブ             | [TestDataDeleteWrapperTest](../../force-app/main/default/classes/TestDataDeleteWrapperTest.cls)             |

画面と[削除バッチ](apex/batches/test-data-delete/index.md)の固定対象・環境判定は既存の`TestDataDeleteService`を共有します。削除集計と継続判定は`TestDataDeleteBatchService`が担当します。

### 取引先一括更新

仕様・配置・権限: [取引先一括更新](lwc/account-mass-update/index.md)。

| LWC                                                                                          | 同Bundleの補助JavaScript                                                                                  |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [accountMassUpdate](../../force-app/main/default/lwc/accountMassUpdate/accountMassUpdate.js) | [accountMassUpdateLogic.js](../../force-app/main/default/lwc/accountMassUpdate/accountMassUpdateLogic.js) |

| Apex本体                                                                                            | 役割                                        | 同名Test                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [AccountMassUpdateController](../../force-app/main/default/classes/AccountMassUpdateController.cls) | 法人取引先の検索と最大200件の一括更新の入口 | [AccountMassUpdateControllerTest](../../force-app/main/default/classes/AccountMassUpdateControllerTest.cls) |
| [AccountMassUpdateSelector](../../force-app/main/default/classes/AccountMassUpdateSelector.cls)     | 法人取引先のページ取得と保存対象のロック    | [AccountMassUpdateSelectorTest](../../force-app/main/default/classes/AccountMassUpdateSelectorTest.cls)     |
| [AccountMassUpdateService](../../force-app/main/default/classes/AccountMassUpdateService.cls)       | 法人取引先一括更新の入力検証と応答生成      | [AccountMassUpdateServiceTest](../../force-app/main/default/classes/AccountMassUpdateServiceTest.cls)       |
| [AccountMassUpdateWrapper](../../force-app/main/default/classes/AccountMassUpdateWrapper.cls)       | 法人取引先の検索条件・更新判定・画面応答    | [AccountMassUpdateWrapperTest](../../force-app/main/default/classes/AccountMassUpdateWrapperTest.cls)       |

### 組織エクスプローラー

仕様・配置・権限: [組織エクスプローラー](lwc/org-explorer/index.md)。

| LWC                                                                                                   | 同Bundleの補助JavaScript                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [orgExplorer](../../force-app/main/default/lwc/orgExplorer/orgExplorer.js)                            | [orgExplorerLogic.js](../../force-app/main/default/lwc/orgExplorer/orgExplorerLogic.js)                   |
| [orgExplorerCanvas](../../force-app/main/default/lwc/orgExplorerCanvas/orgExplorerCanvas.js)          | [orgExplorerCanvasLogic.js](../../force-app/main/default/lwc/orgExplorerCanvas/orgExplorerCanvasLogic.js) |
| [orgExplorerCard](../../force-app/main/default/lwc/orgExplorerCard/orgExplorerCard.js)                | なし（メインJavaScriptに実装）                                                                            |
| [orgExplorerDetails](../../force-app/main/default/lwc/orgExplorerDetails/orgExplorerDetails.js)       | なし（メインJavaScriptに実装）                                                                            |
| [orgExplorerSearch](../../force-app/main/default/lwc/orgExplorerSearch/orgExplorerSearch.js)          | なし（メインJavaScriptに実装）                                                                            |
| [orgExplorerDatatable](../../force-app/main/default/lwc/orgExplorerDatatable/orgExplorerDatatable.js) | なし（メインJavaScriptに実装）                                                                            |

| Apex本体                                                                                                    | 役割                                                 | 同名Test                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [OrgExplorerAccessPolicy](../../force-app/main/default/classes/OrgExplorerAccessPolicy.cls)                 | 組織探索の参照可否と公開例外の生成                   | [OrgExplorerAccessPolicyTest](../../force-app/main/default/classes/OrgExplorerAccessPolicyTest.cls)                 |
| [OrgExplorerCapabilitiesResponse](../../force-app/main/default/classes/OrgExplorerCapabilitiesResponse.cls) | 利用可能な階層モードと制御値                         | [OrgExplorerCapabilitiesResponseTest](../../force-app/main/default/classes/OrgExplorerCapabilitiesResponseTest.cls) |
| [OrgExplorerController](../../force-app/main/default/classes/OrgExplorerController.cls)                     | 読み取り専用の組織エクスプローラー公開API            | [OrgExplorerControllerTest](../../force-app/main/default/classes/OrgExplorerControllerTest.cls)                     |
| [OrgExplorerCursorCodec](../../force-app/main/default/classes/OrgExplorerCursorCodec.cls)                   | 権限を与えないページ継続位置の厳密な変換             | [OrgExplorerCursorCodecTest](../../force-app/main/default/classes/OrgExplorerCursorCodecTest.cls)                   |
| [OrgExplorerMemberService](../../force-app/main/default/classes/OrgExplorerMemberService.cls)               | 組織探索のユーザーノード・メンバー一覧・関連先の変換 | [OrgExplorerMemberServiceTest](../../force-app/main/default/classes/OrgExplorerMemberServiceTest.cls)               |
| [OrgExplorerPageRequest](../../force-app/main/default/classes/OrgExplorerPageRequest.cls)                   | 固定範囲の階層一覧要求                               | [OrgExplorerPageRequestTest](../../force-app/main/default/classes/OrgExplorerPageRequestTest.cls)                   |
| [OrgExplorerPageResponse](../../force-app/main/default/classes/OrgExplorerPageResponse.cls)                 | 階層・メンバー一覧・検索候補の共通応答               | [OrgExplorerPageResponseTest](../../force-app/main/default/classes/OrgExplorerPageResponseTest.cls)                 |
| [OrgExplorerRequestService](../../force-app/main/default/classes/OrgExplorerRequestService.cls)             | 組織探索の一覧要求・継続位置・候補検索の検証         | [OrgExplorerRequestServiceTest](../../force-app/main/default/classes/OrgExplorerRequestServiceTest.cls)             |
| [OrgExplorerSearchRequest](../../force-app/main/default/classes/OrgExplorerSearchRequest.cls)               | ロール・上司の候補検索要求                           | [OrgExplorerSearchRequestTest](../../force-app/main/default/classes/OrgExplorerSearchRequestTest.cls)               |
| [OrgExplorerSelector](../../force-app/main/default/classes/OrgExplorerSelector.cls)                         | 利用者権限を適用したUserとUserRoleの限定照会         | [OrgExplorerSelectorTest](../../force-app/main/default/classes/OrgExplorerSelectorTest.cls)                         |
| [OrgExplorerService](../../force-app/main/default/classes/OrgExplorerService.cls)                           | 組織探索のロール・上司構造と候補・人数の生成         | [OrgExplorerServiceTest](../../force-app/main/default/classes/OrgExplorerServiceTest.cls)                           |

### オブジェクトエクスプローラー

仕様・配置・権限: [オブジェクトエクスプローラー](lwc/object-explorer/index.md)。

| LWC                                                                                                   | 同Bundleの補助JavaScript                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [objectExplorer](../../force-app/main/default/lwc/objectExplorer/objectExplorer.js)                   | [objectExplorerClassifyLogic.js](../../force-app/main/default/lwc/objectExplorer/objectExplorerClassifyLogic.js)、[objectExplorerCsv.js](../../force-app/main/default/lwc/objectExplorer/objectExplorerCsv.js)、[objectExplorerFieldLogic.js](../../force-app/main/default/lwc/objectExplorer/objectExplorerFieldLogic.js)、[objectExplorerLogic.js](../../force-app/main/default/lwc/objectExplorer/objectExplorerLogic.js) |
| [objectExplorerLookup](../../force-app/main/default/lwc/objectExplorerLookup/objectExplorerLookup.js) | なし（メインJavaScriptに実装）                                                                                                                                                                                                                                                                                                                                                                                               |

| Apex本体                                                                                                | 役割                                                     | 同名Test                                                                                                        |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [ObjectExplorerAccessPolicy](../../force-app/main/default/classes/ObjectExplorerAccessPolicy.cls)       | データ分類操作の権限と参照対象を検証                     | [ObjectExplorerAccessPolicyTest](../../force-app/main/default/classes/ObjectExplorerAccessPolicyTest.cls)       |
| [ObjectExplorerClassifyService](../../force-app/main/default/classes/ObjectExplorerClassifyService.cls) | 分類編集の権限・入力・競合と表示モデルの生成             | [ObjectExplorerClassifyServiceTest](../../force-app/main/default/classes/ObjectExplorerClassifyServiceTest.cls) |
| [ObjectExplorerController](../../force-app/main/default/classes/ObjectExplorerController.cls)           | オブジェクト構造探索と項目分類の参照・保存の入口         | [ObjectExplorerControllerTest](../../force-app/main/default/classes/ObjectExplorerControllerTest.cls)           |
| [ObjectExplorerFieldService](../../force-app/main/default/classes/ObjectExplorerFieldService.cls)       | 項目定義の型・分類・作成更新情報の可視表示モデル         | [ObjectExplorerFieldServiceTest](../../force-app/main/default/classes/ObjectExplorerFieldServiceTest.cls)       |
| [ObjectExplorerOwnerService](../../force-app/main/default/classes/ObjectExplorerOwnerService.cls)       | データ分類の所有者ID照合・候補表示・API参照値の生成      | [ObjectExplorerOwnerServiceTest](../../force-app/main/default/classes/ObjectExplorerOwnerServiceTest.cls)       |
| [ObjectExplorerSelector](../../force-app/main/default/classes/ObjectExplorerSelector.cls)               | 項目定義・分類と所有者候補の読み取り                     | [ObjectExplorerSelectorTest](../../force-app/main/default/classes/ObjectExplorerSelectorTest.cls)               |
| [ObjectExplorerService](../../force-app/main/default/classes/ObjectExplorerService.cls)                 | Describeに基づくオブジェクト・項目・直接参照の表示モデル | [ObjectExplorerServiceTest](../../force-app/main/default/classes/ObjectExplorerServiceTest.cls)                 |

Metadata API通信とSOAP形式のクラスは、後述の「共通部品と共有範囲」に分けて記載しています。

### 取引先情報PDF

仕様・配置・権限: [取引先情報PDF](visualforce/account-pdf/index.md)。

| LWC                                                                                       | 同Bundleの補助JavaScript                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [accountPdfExport](../../force-app/main/default/lwc/accountPdfExport/accountPdfExport.js) | [accountPdfExportLogic.js](../../force-app/main/default/lwc/accountPdfExport/accountPdfExportLogic.js) |

| Apex本体                                                                              | 役割                                   | 同名Test                                                                                      |
| ------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| [AccountPdfController](../../force-app/main/default/classes/AccountPdfController.cls) | 取引先 PDF を表示する Visualforce 入口 | [AccountPdfControllerTest](../../force-app/main/default/classes/AccountPdfControllerTest.cls) |
| [AccountPdfSelector](../../force-app/main/default/classes/AccountPdfSelector.cls)     | 取引先 PDF の取引先問い合わせ          | [AccountPdfSelectorTest](../../force-app/main/default/classes/AccountPdfSelectorTest.cls)     |
| [AccountPdfService](../../force-app/main/default/classes/AccountPdfService.cls)       | 取引先 PDF の入力検証と表示値作成      | [AccountPdfServiceTest](../../force-app/main/default/classes/AccountPdfServiceTest.cls)       |
| [AccountPdfViewModel](../../force-app/main/default/classes/AccountPdfViewModel.cls)   | 取引先 PDF に表示する文字列            | [AccountPdfViewModelTest](../../force-app/main/default/classes/AccountPdfViewModelTest.cls)   |

帳票本体: [AccountPdf.page](../../force-app/main/default/pages/AccountPdf.page)。起動用LWCとVisualforceを合わせて一つの帳票機能として扱います。

## 共通部品と共有範囲

名前が汎用的でも、対象機能間で共有されているとは限りません。実際の参照元と機能内の責務共有を分けて記載します。

| 部品                                                                          | 利用元・範囲                                                                         | 共有する責務                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ObjectMetricCatalog`                                                         | データボード、汎用レコード検索                                                       | 表示キー・オブジェクト対応と問い合わせ対象の許可リスト                                                                                                   |
| `OrgEnvironment`                                                              | 取引先一括削除の画面Service・バッチService。定期起動も同じバッチを使用               | 開発環境の判定。テストデータ一括削除の環境判定には使用しない                                                                                             |
| `MetadataApiIntegrationClient`、`MetadataApiProtocol`、`MetadataApiSoapCodec` | 現行の利用機能はオブジェクトエクスプローラー                                         | Named Credential経由のHTTP通信と、SOAPの生成・応答検証                                                                                                   |
| `TestDataDeleteService`                                                       | テストデータ一括削除の画面・バッチ                                                   | 固定の削除順序と環境判定。通常Sandboxを許可する`OrgEnvironment`とは条件が異なる                                                                          |
| `OrgExplorerPageResponse`等の要求・応答型                                     | 組織エクスプローラーのロール階層・上司階層・候補・メンバー取得                       | 同じ要求・応答の契約を機能内で共有                                                                                                                       |
| [errorUtils](../../force-app/main/default/lwc/errorUtils/errorUtils.js)       | 取引先データ品質スキャン、データボード、汎用レコード検索、ケースメールメッセージ一覧 | Apex・UI APIエラーの業務メッセージ変換と、共通例外境界向けの本文を含まない診断を生成する共通JavaScript。テストは同Bundleの`__tests__/errorUtils.test.js` |
| `uiErrorBoundary` / `uiErrorPanel`                                            | 画面LWCとモーダル（オブジェクトエクスプローラーの既存実装は除く）                    | [画面内の共通エラー表示](lwc/ui-error-boundary/index.md)。失敗場所の表示と子の例外捕捉、エラー時だけの診断記録                                           |
| `objectRecordSearch`                                                          | データボードに組み込む汎用レコード検索機能                                           | 検索・フォーム・削除の画面を再利用。専用Apexの所属は汎用レコード検索                                                                                     |

| Apex本体                                                                                              | 役割                                                 | 同名Test                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [ObjectMetricCatalog](../../force-app/main/default/classes/ObjectMetricCatalog.cls)                   | データボードで扱うオブジェクト定義一元管理           | [ObjectMetricCatalogTest](../../force-app/main/default/classes/ObjectMetricCatalogTest.cls)                   |
| [OrgEnvironment](../../force-app/main/default/classes/OrgEnvironment.cls)                             | 現在の Salesforce 組織の実行環境情報を提供           | [OrgEnvironmentTest](../../force-app/main/default/classes/OrgEnvironmentTest.cls)                             |
| [MetadataApiIntegrationClient](../../force-app/main/default/classes/MetadataApiIntegrationClient.cls) | Named Credential経由の項目メタデータ読み取り・更新   | [MetadataApiIntegrationClientTest](../../force-app/main/default/classes/MetadataApiIntegrationClientTest.cls) |
| [MetadataApiProtocol](../../force-app/main/default/classes/MetadataApiProtocol.cls)                   | API要求・応答の検証と安全な固定診断                  | [MetadataApiProtocolTest](../../force-app/main/default/classes/MetadataApiProtocolTest.cls)                   |
| [MetadataApiSoapCodec](../../force-app/main/default/classes/MetadataApiSoapCodec.cls)                 | Metadata SOAPのXML生成・応答形式・項目の完全名を検証 | [MetadataApiSoapCodecTest](../../force-app/main/default/classes/MetadataApiSoapCodecTest.cls)                 |

### テスト専用の共通クラス

| クラス                                                                      | 利用元・責務                                                           | 同名Test                                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [TestDataFactory](../../force-app/main/default/classes/TestDataFactory.cls) | Apexテストのユーザー・レコード・権限割当準備。本番クラスからは呼ばない | [TestDataFactoryTest](../../force-app/main/default/classes/TestDataFactoryTest.cls) |

### 画面・帳票以外の関連Apex

画面・帳票の専用クラスと混同しないよう、取引先保存に伴う自動処理と、対象画面から直接使用されていない汎用クラスを分けて記載します。

| Apex本体                                                                                | 役割                                           | 同名Test                                                                                        |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [AccountTriggerHandler](../../force-app/main/default/classes/AccountTriggerHandler.cls) | 取引先トリガーハンドラークラス                 | [AccountTriggerHandlerTest](../../force-app/main/default/classes/AccountTriggerHandlerTest.cls) |
| [AccountTriggerService](../../force-app/main/default/classes/AccountTriggerService.cls) | 取引先トリガーから呼び出されるユースケース調整 | [AccountTriggerServiceTest](../../force-app/main/default/classes/AccountTriggerServiceTest.cls) |
| [DateTimeUtil](../../force-app/main/default/classes/DateTimeUtil.cls)                   | 日付と時刻の変換・判定処理を提供               | [DateTimeUtilTest](../../force-app/main/default/classes/DateTimeUtilTest.cls)                   |
| [StringUtil](../../force-app/main/default/classes/StringUtil.cls)                       | 文字列の変換・分割処理を提供                   | [StringUtilTest](../../force-app/main/default/classes/StringUtilTest.cls)                       |

- `AccountTriggerHandler`と`AccountTriggerService`は[取引先トリガー](apex/triggers/account-trigger/index.md)の構成です。取引先の作成・名称変更に伴って動作し、画面専用のControllerではありません。
- `DateTimeUtil`と`StringUtil`は対象画面・帳票の本体から直接参照されていません。共通部品として存在することと、現在の利用実績は区別します。

## 一覧の確認方法

- Apex本体を追加・削除・改名した場合は、所属機能と同名Testのリンクを合わせて更新します。内部クラスを別ファイルの本体として重複掲載しません。
- LWCの`@salesforce/apex` import、子LWC、JavaScript import、Apexの参照先と照合します。テスト専用参照は機能の実行時依存へ含めません。
- 一つの機能が別の機能を組み込む場合は、構成を複製せず所属先へ案内します。共通クラスは利用元・共有範囲も合わせて更新します。
- 組織への反映・削除の成否やテスト実測値はこの一覧では保証しません。実行ログと対象組織の確認結果を別に参照します。
