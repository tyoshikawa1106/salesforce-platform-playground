# 汎用レコード検索

## 概要

データボードで選択した標準オブジェクトのレコードを、検索、ソート、ページ移動し、権限と対応状況に応じて作成、編集、削除、ファイルアップロードできるLightning Web Componentです。

## 目的・利用場面

データボードの件数カードから対象レコードの内容を確認し、同じ画面内で基本的なレコード操作を行うために利用します。

## 対象実装・メタデータ

Apex本体と同名Test、補助LWC、共通部品の対応は[画面・帳票の構成一覧](../../screen-and-report-components.md)も参照してください。

### LWC

| 種別           | API 名・ファイル名                | 役割                                            |
| -------------- | --------------------------------- | ----------------------------------------------- |
| LWC            | `objectRecordSearch`              | 検索条件、一覧、ページング、作成、編集、削除 UI |
| LWC            | `objectRecordFormModal`           | 標準モーダル内のレコード保存・アップロード      |
| LWC JavaScript | `objectRecordFormModalLogic.js`   | 保存・アップロード結果とエラー表示値の生成      |
| LWC            | `errorUtils`                      | Apex と UI API エラーのメッセージ変換           |
| LWC JavaScript | `objectRecordSearch.js`           | 画面操作と Apex、UI API 呼び出しの統括          |
| LWC JavaScript | `objectRecordSearchLogic.js`      | 画面単位の検索、一覧、フォーム状態生成          |
| LWC JavaScript | `errorUtils.js`                   | Apex と UI API エラーのメッセージ変換           |
| LWC JavaScript | `objectRecordSearchDisplay.js`    | 一覧列と表示行の組み立て                        |
| LWC JavaScript | `objectRecordSearchForm.js`       | レコードフォームとレイアウトの組み立て          |
| LWC JavaScript | `objectRecordSearchFormPolicy.js` | オブジェクト別のフォーム対応方針                |
| LWC JavaScript | `objectRecordSearchState.js`      | 検索、ソート、ページング状態の管理              |

### 設定・権限

- `LwcObjectRecordSearch`: [ObjectRecordSearchController](../../../../force-app/main/default/classes/ObjectRecordSearchController.cls)のApexクラス実行権限

### Apexコードと対応テスト

| Apex本体                                                                                                            | 役割                                                       | 同名Test                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [ObjectRecordSearchConfigWrapper](../../../../force-app/main/default/classes/ObjectRecordSearchConfigWrapper.cls)   | 汎用レコード検索画面の設定を LWC に返す Wrapper            | [ObjectRecordSearchConfigWrapperTest](../../../../force-app/main/default/classes/ObjectRecordSearchConfigWrapperTest.cls)   |
| [ObjectRecordSearchContext](../../../../force-app/main/default/classes/ObjectRecordSearchContext.cls)               | 汎用レコード検索の Apex 内部処理で共有する状態             | [ObjectRecordSearchContextTest](../../../../force-app/main/default/classes/ObjectRecordSearchContextTest.cls)               |
| [ObjectRecordSearchController](../../../../force-app/main/default/classes/ObjectRecordSearchController.cls)         | データボードから遷移する汎用レコード検索画面の Apex 入口   | [ObjectRecordSearchControllerTest](../../../../force-app/main/default/classes/ObjectRecordSearchControllerTest.cls)         |
| [ObjectRecordSearchDeleteWrapper](../../../../force-app/main/default/classes/ObjectRecordSearchDeleteWrapper.cls)   | 汎用レコード検索画面に返す削除結果 Wrapper                 | [ObjectRecordSearchDeleteWrapperTest](../../../../force-app/main/default/classes/ObjectRecordSearchDeleteWrapperTest.cls)   |
| [ObjectRecordSearchFieldCatalog](../../../../force-app/main/default/classes/ObjectRecordSearchFieldCatalog.cls)     | 汎用レコード検索の一覧に追加表示する固定項目管理           | [ObjectRecordSearchFieldCatalogTest](../../../../force-app/main/default/classes/ObjectRecordSearchFieldCatalogTest.cls)     |
| [ObjectRecordSearchFieldWrapper](../../../../force-app/main/default/classes/ObjectRecordSearchFieldWrapper.cls)     | 汎用レコード検索画面の一覧に表示する固定項目の Wrapper     | [ObjectRecordSearchFieldWrapperTest](../../../../force-app/main/default/classes/ObjectRecordSearchFieldWrapperTest.cls)     |
| [ObjectRecordSearchQueryPlan](../../../../force-app/main/default/classes/ObjectRecordSearchQueryPlan.cls)           | 汎用レコード検索で共有する問い合わせ条件の保持と検証       | [ObjectRecordSearchQueryPlanTest](../../../../force-app/main/default/classes/ObjectRecordSearchQueryPlanTest.cls)           |
| [ObjectRecordSearchRequestWrapper](../../../../force-app/main/default/classes/ObjectRecordSearchRequestWrapper.cls) | 汎用レコード検索画面から Apex に渡す検索リクエスト Wrapper | [ObjectRecordSearchRequestWrapperTest](../../../../force-app/main/default/classes/ObjectRecordSearchRequestWrapperTest.cls) |
| [ObjectRecordSearchResultWrapper](../../../../force-app/main/default/classes/ObjectRecordSearchResultWrapper.cls)   | 汎用レコード検索画面に返す検索結果 Wrapper                 | [ObjectRecordSearchResultWrapperTest](../../../../force-app/main/default/classes/ObjectRecordSearchResultWrapperTest.cls)   |
| [ObjectRecordSearchRowWrapper](../../../../force-app/main/default/classes/ObjectRecordSearchRowWrapper.cls)         | 汎用レコード検索画面の一覧行 Wrapper                       | [ObjectRecordSearchRowWrapperTest](../../../../force-app/main/default/classes/ObjectRecordSearchRowWrapperTest.cls)         |
| [ObjectRecordSearchSelector](../../../../force-app/main/default/classes/ObjectRecordSearchSelector.cls)             | 汎用レコード検索画面で使う Salesforce レコード問い合わせ   | [ObjectRecordSearchSelectorTest](../../../../force-app/main/default/classes/ObjectRecordSearchSelectorTest.cls)             |
| [ObjectRecordSearchService](../../../../force-app/main/default/classes/ObjectRecordSearchService.cls)               | 汎用レコード検索画面の判定と Wrapper 組み立て提供          | [ObjectRecordSearchServiceTest](../../../../force-app/main/default/classes/ObjectRecordSearchServiceTest.cls)               |
| [ObjectRecordSearchSortSupport](../../../../force-app/main/default/classes/ObjectRecordSearchSortSupport.cls)       | 汎用レコード検索のソート条件とページングカーソル取り扱い   | [ObjectRecordSearchSortSupportTest](../../../../force-app/main/default/classes/ObjectRecordSearchSortSupportTest.cls)       |
| [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls)                           | データボードで扱うオブジェクト定義一元管理                 | [ObjectMetricCatalogTest](../../../../force-app/main/default/classes/ObjectMetricCatalogTest.cls)                           |

テストの共通準備は[TestDataFactory](../../../../force-app/main/default/classes/TestDataFactory.cls)、その契約は[TestDataFactoryTest](../../../../force-app/main/default/classes/TestDataFactoryTest.cls)で確認できます。

## 入力

- `metricKey`: [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls) に定義されたデータボードカードキー
- 検索語: 対象オブジェクトの `Name` 相当項目に対する部分一致条件
- ソート項目と昇順、降順
- ページ番号、標準PaginationCursorと取得位置
- 削除対象として選択したレコード ID
- 作成、編集フォームへの入力、またはファイルアップロード

## 処理内容

1. `metricKey` から対象オブジェクトを解決し、オブジェクトと `Name` 相当項目の参照、検索、作成、更新、削除可否を Describe で取得します。
2. オブジェクト別の固定表示項目から、利用者が参照できる項目だけを一覧列にします。
3. 検索、ソート、ページ移動を処理します。詳細は [検索・ソート・ページング](search-and-pagination.md) を参照してください。
4. 権限とオブジェクト別の対応状況に応じて、作成、編集、削除、ファイルアップロードを処理します。詳細は [レコード操作](record-operations.md) を参照してください。
5. レコード変更後は親のデータボードへ `recordschanged` イベントを通知し、一覧を再読み込みします。

## 出力・更新対象

- 対象オブジェクトの `Name` 相当項目と、参照可能な追加表示項目の一覧
- 検索、ソート、前後ページ移動の結果
- UI API によるレコード作成、更新
- `ContentDocument` 向けのファイルアップロード
- 選択レコードの削除結果。成功件数と行単位エラーを表示します。

## 権限・実行条件

- 親の `objectMetricsOverview` から有効な `metricKey` が渡されることを前提とします。
- `LwcObjectRecordSearch` Permission Setで、LWCから直接呼び出す[ObjectRecordSearchController](../../../../force-app/main/default/classes/ObjectRecordSearchController.cls)のApexクラス実行権限を付与します。Controllerから呼び出す内部クラスへ個別のApexクラス実行権限を付与する必要はありません。
- 対象オブジェクトが参照可能かつクエリ可能で、`Name` 相当項目を参照できる必要があります。
- 一覧取得と削除は `with sharing`、`AccessLevel.USER_MODE` で利用者の権限を適用します。
- 検索語は任意フィルターとして扱い、空の場合も許可済みオブジェクトと項目、決定的なソート、[検索・ページング仕様](search-and-pagination.md#制約注意事項)の取得上限で初期一覧を取得します。
- 作成、編集、削除ボタンは Describe 結果と UI 対応状況に応じて無効化します。
- 表示項目は項目レベル参照権限で絞り込みます。

## エラー処理

- 想定内の状態を例外型で識別せず、下位層の判定結果と Controller の固定メッセージを境界にします。空の独自例外では公開可能なメッセージを保証できないため、`ObjectRecordSearchException` は使用しません。
- 未定義のカードキー、利用できないオブジェクト、参照不可の `Name` 相当項目、不正なページ取得位置は、Service が判定結果と原因コードで Controller へ返します。
- Controller は原因コードを利用者が次の操作を選べるメッセージへ対応付け、LWC の境界で `AuraHandledException` として返します。
- 内部の検索状態や検索条件が成立しない場合は処理を継続せず、Controller が内部エラーの詳細を公開しない一般化メッセージへ変換します。
- 予期しない検索、設定、削除エラーは操作別の一般化メッセージに変換します。
- 削除は部分成功を許容し、失敗した行ごとに一般化したエラーを返します。
- UI API の作成、編集エラーとファイルアップロードエラーはトーストまたはフォームメッセージで表示します。

## 関連コンポーネント

- [データボード](../object-metrics-overview/index.md)
- [検索・ソート・ページング](search-and-pagination.md)
- [レコード操作](record-operations.md)
- Lightning UI Object Info API、Layout API、Record Edit Form、File Upload

## テスト・確認観点

- [ObjectRecordSearchFieldCatalogTest](../../../../force-app/main/default/classes/ObjectRecordSearchFieldCatalogTest.cls)で、固定表示列の順序、表示型、ソート可否、未定義オブジェクトの扱いを確認すること

- [ObjectRecordSearchControllerTest](../../../../force-app/main/default/classes/ObjectRecordSearchControllerTest.cls)、[ObjectRecordSearchSelectorTest](../../../../force-app/main/default/classes/ObjectRecordSearchSelectorTest.cls)、[ObjectRecordSearchServiceTest](../../../../force-app/main/default/classes/ObjectRecordSearchServiceTest.cls) で、設定取得、検索語の正規化、任意フィルターなしの初期一覧、ページング、削除、不正入力を確認すること
- [ObjectRecordSearchSelectorTest](../../../../force-app/main/default/classes/ObjectRecordSearchSelectorTest.cls)、[ObjectRecordSearchQueryPlanTest](../../../../force-app/main/default/classes/ObjectRecordSearchQueryPlanTest.cls)、[ObjectRecordSearchSortSupportTest](../../../../force-app/main/default/classes/ObjectRecordSearchSortSupportTest.cls) で、動的 SOQL と bind、許可済み検索条件、固定取得件数、昇順・降順ソート、カーソル、不正ページ取得位置を確認すること
- `objectRecordSearch.test.js`、`objectRecordSearchPaging.test.js`、`objectRecordSearchFormFlow.test.js` で、一覧表示、検索、ページ移動、レコード操作、権限メッセージ、エラー、親イベント通知を確認すること
- 対応する各オブジェクトで `Name` 相当項目と追加表示項目が正しく表示されることを確認します。
- 権限の異なるユーザーでボタン状態、表示列、検索、各 DML を確認します。

## 制約・注意事項

- 検索対象は [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls) に定義されたオブジェクトだけです。
- 検索とページングの制約は [検索・ソート・ページング](search-and-pagination.md) に記載します。
- 作成、編集、削除、ファイルアップロードの制約は [レコード操作](record-operations.md) に記載します。

## 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装は `objectRecordSearch`、関連Apexクラス、Apexテスト、Jestテストから確認しています。
- 承認済み要求または画面要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。
