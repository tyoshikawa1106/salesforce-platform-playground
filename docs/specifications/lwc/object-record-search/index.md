# 汎用レコード検索

## 概要

データボードで選択した標準オブジェクトのレコードを、検索、ソート、ページ移動し、権限と対応状況に応じて作成、編集、削除、ファイルアップロードできるLightning Web Componentです。

## 目的・利用場面

データボードの件数カードから対象レコードの内容を確認し、同じ画面内で基本的なレコード操作を行うために利用します。

## 対象実装・メタデータ

### LWC

| 種別           | API 名・ファイル名                | 役割                                            |
| -------------- | --------------------------------- | ----------------------------------------------- |
| LWC            | `objectRecordSearch`              | 検索条件、一覧、ページング、作成、編集、削除 UI |
| LWC            | `errorUtils`                      | Apex と UI API エラーのメッセージ変換           |
| LWC JavaScript | `objectRecordSearch.js`           | 画面操作と Apex、UI API 呼び出しの統括          |
| LWC JavaScript | `errorUtils.js`                   | Apex と UI API エラーのメッセージ変換           |
| LWC JavaScript | `objectRecordSearchDisplay.js`    | 一覧列と表示行の組み立て                        |
| LWC JavaScript | `objectRecordSearchForm.js`       | レコードフォームとレイアウトの組み立て          |
| LWC JavaScript | `objectRecordSearchFormPolicy.js` | オブジェクト別のフォーム対応方針                |
| LWC JavaScript | `objectRecordSearchState.js`      | 検索、ソート、ページング状態の管理              |

### Apex

| 種別       | API 名                                  | 役割                                     |
| ---------- | --------------------------------------- | ---------------------------------------- |
| Apex Class | `ObjectRecordSearchController`          | 検索と削除の Apex 入口                   |
| Apex Class | `ObjectRecordSearchSelector`            | Describe、USER_MODE 検索、USER_MODE 削除 |
| Apex Class | `ObjectRecordSearchService`             | 設定、検索結果、削除結果の組み立て       |
| Apex Class | `ObjectRecordSearchQueryPlan`           | 許可済み条件による動的 SOQL 生成         |
| Apex Class | `ObjectRecordSearchSortSupport`         | ソート条件の検証                         |
| Apex Class | `ObjectRecordSearchPageTokenCodec`      | カーソルページング用トークンの変換       |
| Apex Class | `ObjectRecordSearchDisplayFieldCatalog` | オブジェクト別の追加表示項目定義         |
| Apex Class | `ObjectMetricCatalog`                   | カードキーと対象オブジェクトの許可リスト |
| Apex Class | `ObjectRecordSearchConfigWrapper`       | 検索画面の設定情報                       |
| Apex Class | `ObjectRecordSearchContext`             | 内部検索状態                             |
| Apex Class | `ObjectRecordSearchDeleteWrapper`       | 削除要求と削除結果                       |
| Apex Class | `ObjectRecordSearchException`           | 検索機能固有の例外                       |
| Apex Class | `ObjectRecordSearchFieldWrapper`        | 表示項目情報                             |
| Apex Class | `ObjectRecordSearchRequestWrapper`      | 検索要求                                 |
| Apex Class | `ObjectRecordSearchResultWrapper`       | 検索結果                                 |
| Apex Class | `ObjectRecordSearchRowWrapper`          | 一覧の行情報                             |

## 入力

- `metricKey`: `ObjectMetricCatalog` に定義されたデータボードカードキー
- 検索語: 対象オブジェクトの `Name` 相当項目に対する部分一致条件
- ソート項目と昇順、降順
- ページ番号とページトークン
- 削除対象として選択したレコード ID
- 作成、編集フォームへの入力、またはファイルアップロード

## 処理内容

1. `metricKey` から対象オブジェクトを解決し、オブジェクトと `Name` 相当項目の参照、検索、作成、更新、削除可否を Describe で取得します。
2. オブジェクト別の固定表示項目から、利用者が参照できる項目だけを一覧列にします。
3. 検索、ソート、ページ移動を処理します。詳細は [検索・ソート・ページング](search-and-pagination.md) を参照してください。
4. 権限とオブジェクト別の対応状況に応じて、作成、編集、削除、ファイルアップロードを処理します。詳細は [レコード操作](record-operations.md) を参照してください。
5. レコード変更後は一覧を再読み込みし、親のデータボードへ `recordschanged` イベントを通知します。

## 出力・更新対象

- 対象オブジェクトの `Name` 相当項目と、参照可能な追加表示項目の一覧
- 検索、ソート、前後ページ移動の結果
- UI API によるレコード作成、更新
- `ContentDocument` 向けのファイルアップロード
- 選択レコードの削除結果。成功件数と行単位エラーを表示します。

## 権限・実行条件

- 親の `objectMetricsOverview` から有効な `metricKey` が渡されることを前提とします。
- `ObjectRecordSearchController` と関連 Apex クラスの実行権限が必要です。
- 対象オブジェクトが参照可能かつクエリ可能で、`Name` 相当項目を参照できる必要があります。
- 一覧取得と削除は `with sharing`、`AccessLevel.USER_MODE` で利用者の権限を適用します。
- 作成、編集、削除ボタンは Describe 結果と UI 対応状況に応じて無効化します。
- 表示項目は項目レベル参照権限で絞り込みます。

## エラー処理

- 未定義のカードキー、参照不可のオブジェクト、参照不可の `Name` 相当項目、不正な検索条件やページトークンは、利用者向けの `AuraHandledException` に変換します。
- 予期しない検索、設定、削除エラーは操作別の一般化メッセージに変換します。
- 削除は部分成功を許容し、失敗した行ごとに一般化したエラーを返します。
- UI API の作成、編集エラーとファイルアップロードエラーはトーストまたはフォームメッセージで表示します。

## 関連コンポーネント

- [データボード](../object-metrics-overview/index.md)
- [検索・ソート・ページング](search-and-pagination.md)
- [レコード操作](record-operations.md)
- Lightning UI Object Info API、Layout API、Record Edit Form、File Upload

## テスト・確認観点

- Apex テストで設定取得、検索、ページング、権限判定、削除、不正入力を確認します。
- Jest テストで一覧表示、検索、ページ移動、レコード操作、権限メッセージ、エラー、親イベント通知を確認します。
- 対応する各オブジェクトで `Name` 相当項目と追加表示項目が正しく表示されることを確認します。
- 権限の異なるユーザーでボタン状態、表示列、検索、各 DML を確認します。

## 制約・注意事項

- 検索対象は `ObjectMetricCatalog` に定義されたオブジェクトだけです。
- 検索とページングの制約は [検索・ソート・ページング](search-and-pagination.md) に記載します。
- 作成、編集、削除、ファイルアップロードの制約は [レコード操作](record-operations.md) に記載します。
