# 検索・ソート・ページング

## 概要

`objectRecordSearch` の一覧を、Apex標準の `Database.PaginationCursor` でページ取得します。

## 入力

- `metricKey`: `ObjectMetricCatalog` に定義されたカードキー
- `searchTerm`: `Name` 相当項目へ適用する検索語
- `sortBy`: 一覧で選択されたソート項目
- `sortDirection`: `asc` または `desc`
- `paginationCursor`: 初回はnull、継続取得では前回返された標準カーソル
- `startIndex`: 標準APIが返した取得位置。初回は0
- `pageNumber`: 画面に表示するページ番号

## 処理内容

1. カードキーから許可済みオブジェクトを解決し、Describeで参照権限と項目を確認します。
2. 検索語の前後空白を除去し、検索可能なName相当項目に部分一致条件を設定します。検索語はbind値で渡します。
3. ソート項目をName相当項目または参照可能でソート可能な追加項目に限定します。
4. 初回は `Database.getPaginationCursorWithBinds` を `AccessLevel.USER_MODE` で呼び出します。並び順は `ORDER BY <指定項目> ASC/DESC NULLS LAST, Id ASC`で、取得上限を設定します。
5. 継続取得では標準カーソルの `fetchPage(startIndex, fetchSize)` を使い、ページサイズを上限に取得します。独自のソート値比較WHERE条件やOFFSETは使用しません。
6. `CursorFetchResult.getNextIndex()` を次の取得位置に使用します。カーソル件数と取得位置から次ページ有無を判定します。

検索・ソート条件変更時はカーソルとページ履歴を初期化します。再読み込み、保存・削除後の更新では先頭ページのwireを `refreshApex` し、結果集合を作り直します。応答待ちの間は追加の検索・ページ操作を抑止します。同一条件の再操作では新しい応答待ちを開始しません。

## 出力・更新対象

- 検索画面設定とページ単位の表示行
- ページサイズ、現在ページ番号、次ページ有無
- 標準カーソルと `nextIndex`
- 表示上限到達を示す `isResultLimitReached`

Boolean、数値、日付、日時、nullは元の型を保持します。日時はUTCのISO 8601文字列で返し、画面では年月日と時・分を表示します。Date専用項目は日付だけを表示します。Name相当項目がnullの場合のId代替ラベルは表示専用です。

一覧取得ではレコードを作成・更新・削除しません。

## 権限・実行条件

- 対象オブジェクトが参照可能かつクエリ可能で、Name相当項目を参照できる必要があります。
- 表示項目は項目レベル参照権限で絞り込みます。
- `with sharing` と `AccessLevel.USER_MODE` を適用します。

## エラー処理

- 未定義のカードキー、利用不能なオブジェクト・項目は利用者向けエラーにします。
- 負の取得位置と、カーソルなしで先頭以外を要求した場合は拒否します。
- カーソル失効などの取得失敗では古い一覧を消し、再読み込みで先頭から取得できます。
- 検索条件変更後の先頭ページ取得が失敗した場合も、その条件のwire応答を再読み込みに使用します。再取得が失敗した場合は操作待ちを解除し、再読み込みや検索をやり直せます。
- 予期しない例外は一般化した検索エラーとして表示します。

## テスト・確認観点

- `ObjectRecordSearchPaginationTest` で設定順と字句順が異なる商談フェーズ、Booleanの両値、同値のページ境界、nullを含む一覧を検証します。
- 全ページを連結したIDと順序を同じORDER BYの結果と比較します。標準カーソルのJSON往復と先頭ページへの復帰も確認します。
- Controller、Service、Selector、QueryPlan、SortSupportの関連テストで検索語、権限、ソート指定、不正な取得位置と空結果を確認します。
- LWCテストでサーバーへのソート指定、前後ページ、検索条件変更、再読み込み、日時表示、操作待機と失敗後の復帰を確認します。

## 制約・注意事項

- 1ページは50件固定です。検索対象はName相当項目のみです。
- 標準PaginationCursorの上限に合わせて最大100,000件を取得します。上限到達時には検索条件を絞る案内を表示します。全件を表示できたとは断定しません。
- ページ番号は表示用であり、取得位置の計算には使いません。
- 標準カーソルの有効期間とAPI制限に従います。データ変更後は再読み込みが必要です。
- ソート不可項目を直接Apexへ指定した場合は、Name相当項目へフォールバックします。

## 関連情報

- [Apex Developer Guide: Pagination Cursors](https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/salesforce_apex_developer_guide.pdf)

## 既知の差異・確認事項

- ページ取得は標準PaginationCursorへ統一しています。独自の境界値比較による取得制御はありません。
- 取得上限を超える結果と標準カーソルの有効期間はSalesforceの制約に従います。無制限の全件取得は保証しません。
