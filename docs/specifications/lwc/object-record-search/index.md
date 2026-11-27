# 汎用レコード検索

## 機能の用途

データボードで選択した標準オブジェクトのレコードを、検索、ソート、ページ移動し、権限と対応状況に応じて作成、編集、削除、ファイルアップロードできるLightning Web Componentです。

データボードの件数カードから対象レコードの内容を確認し、同じ画面内で基本的なレコード操作を行うために利用します。

### 権限・実行条件

- 親の `objectMetricsOverview` から有効な `metricKey` が渡されることを前提とします。
- `LwcObjectRecordSearch` Permission Setで、LWCから直接呼び出す[ObjectRecordSearchController](../../../../force-app/main/default/classes/ObjectRecordSearchController.cls)のApexクラス実行権限を付与します。Controllerから呼び出す内部クラスへ個別のApexクラス実行権限を付与する必要はありません。
- 対象オブジェクトが参照可能かつクエリ可能で、`Name` 相当項目を参照できる必要があります。
- 一覧取得と削除は `with sharing`、`AccessLevel.USER_MODE` で利用者の権限を適用します。
- 検索語は任意フィルターとして扱い、空の場合も許可済みオブジェクトと項目、決定的なソート、[検索・ページング仕様](#検索ソートページング)の取得上限で初期一覧を取得します。
- 作成、編集、削除ボタンは Describe 結果と UI 対応状況に応じて無効化します。
- 表示項目は項目レベル参照権限で絞り込みます。

### レコード操作の利用条件

- 作成、更新、削除の可否はオブジェクトの Describe 結果を使用します。
- フォームに表示できる項目は UI API、ページレイアウト、項目レベル権限に依存します。
- 削除対象の取得と削除DMLは利用者の共有設定と権限を適用します。
- 操作中、必要な権限がない操作、対応外の操作はボタンを無効化します。
- 保存中は二重送信を防ぎ、［閉じる］、右上の×、Escapeでフォームを閉じられます。結果が返る前に閉じた場合は、一覧の［再読み込み］で結果を確認できます。

### 検索・ソート・ページングの利用条件

- 対象オブジェクトが参照可能かつクエリ可能で、Name相当項目を参照できる必要があります。
- 表示項目は項目レベル参照権限で絞り込みます。
- `with sharing` と `AccessLevel.USER_MODE` を適用します。

## 対象メタデータ

診断情報の整形・重複した状態更新の抑止は内部APIモジュール[lwcLoggerUtils](../../../../force-app/main/default/lwc/lwcLoggerUtils/lwcLoggerUtils.js)を共用します。例外種別の判定、画面固有の案内・復旧操作、表示状態の保持は各画面で管理し、コンソールへ診断情報やAPI応答本文を出力しません。共通の安全化と記録条件は[対応テスト](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)で、各画面との接続は画面側のテストで確認します。

Salesforce API応答の表示メッセージ整形は内部APIモジュール[salesforceApiUtils](../../../../force-app/main/default/lwc/salesforceApiUtils/salesforceApiUtils.js)を使用します。Apex・UI API形式、複数メッセージの順序と代替文言は[共通テスト](../../../../force-app/main/default/lwc/salesforceApiUtils/__tests__/salesforceApiUtils.test.js)で確認します。権限不足の判定、画面状態と復旧操作はこの画面で管理します。

Apex本体と対応するテストクラス、補助LWC、共通部品の対応は[画面・帳票の構成一覧](../../screen-and-report-components.md)も参照してください。

### 画面・JavaScript

| 種別       | 実装・設定                                                                                                                   | 役割                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| LWC        | [objectRecordSearch](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearch.js)                        | 検索条件、一覧、ページング、作成、編集、削除 UI |
| LWC        | [objectRecordFormModal](../../../../force-app/main/default/lwc/objectRecordFormModal/objectRecordFormModal.js)               | 標準モーダル内のレコード保存・アップロード      |
| JavaScript | [objectRecordFormModalLogic.js](../../../../force-app/main/default/lwc/objectRecordFormModal/objectRecordFormModalLogic.js)  | 保存・アップロード結果とエラー表示値の生成      |
| JavaScript | [objectRecordSearch.js](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearch.js)                     | 画面操作と Apex、UI API 呼び出しの統括          |
| JavaScript | [objectRecordSearchLogic.js](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchLogic.js)           | 画面単位の検索、一覧、フォーム状態生成          |
| JavaScript | [objectRecordSearchDisplay.js](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchDisplay.js)       | 一覧列と表示行の組み立て                        |
| JavaScript | [objectRecordSearchForm.js](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchForm.js)             | レコードフォームとレイアウトの組み立て          |
| JavaScript | [objectRecordSearchFormPolicy.js](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchFormPolicy.js) | オブジェクト別のフォーム対応方針                |
| JavaScript | [objectRecordSearchState.js](../../../../force-app/main/default/lwc/objectRecordSearch/objectRecordSearchState.js)           | 検索、ソート、ページング状態の管理              |

### Apexコードと対応テスト

| Apex本体                                                                                                            | 役割                                                       | 対応するテストクラス                                                                                                        |
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

テストデータの準備は、対応する対応するテストクラスの内部で管理します。

### 設定・権限

| 種別       | 実装・設定                                               | 役割                                                                                                                            |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 権限セット | LWC：オブジェクトレコード検索（`LwcObjectRecordSearch`） | [ObjectRecordSearchController](../../../../force-app/main/default/classes/ObjectRecordSearchController.cls)のApexクラス実行権限 |

### 関連コンポーネント

- [データボード](../object-metrics-overview/index.md)
- [検索・ソート・ページング](#検索ソートページング)
- [レコード操作](#レコード操作)
- Lightning UI Object Info API、Layout API、Record Edit Form、File Upload

## アクセスするデータ・項目

削除対象を照合するクエリの形式です。対象オブジェクトは固定のカタログから決定します。検索一覧は参照可能な表示項目とソート条件を使って別途取得します。

```sql
SELECT Id
FROM {対象オブジェクト}
WHERE Id IN :recordIds
LIMIT :recordLimit
```

- 対象オブジェクトの `Name` 相当項目と、参照可能な追加表示項目の一覧
- 検索、ソート、前後ページ移動の結果
- UI API によるレコード作成、更新
- `ContentDocument` 向けのファイルアップロード
- 選択レコードの削除結果。成功件数と行単位エラーを表示します。

### クエリの組み立て

取得項目や検索条件を指定する実装は、[ObjectRecordSearchSelector.cls](../../../../force-app/main/default/classes/ObjectRecordSearchSelector.cls)で確認できます。

### レコード操作の対象データ

- UI API による対象オブジェクトのレコード作成、更新
- ContentDocument向けのファイルアップロード
- 選択レコードの削除結果と、成功件数、失敗行のエラー
- 操作成功後に再読み込みした一覧と、親のデータボードへ通知する変更イベント

### 検索・ソート・ページングの対象データ

- 検索画面設定とページ単位の表示行
- ページサイズ、現在ページ番号、次ページ有無
- 標準カーソルと `nextIndex`
- 表示上限到達を示す `isResultLimitReached`

Boolean、数値、日付、日時、nullは元の型を保持します。日時はUTCのISO 8601文字列で返し、画面では年月日と時・分を表示します。Date専用項目は日付だけを表示します。Name相当項目がnullの場合のId代替ラベルは表示専用です。

一覧取得ではレコードを作成・更新・削除しません。

## 操作

データボードから対象を選び、一覧で検索・並べ替え・レコード操作を行います。

- `metricKey`: [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls) に定義されたデータボードカードキー
- 検索語: 対象オブジェクトの `Name` 相当項目に対する部分一致条件
- ソート項目と昇順、降順
- ページ番号、標準PaginationCursorと取得位置
- 削除対象として選択したレコード ID
- 作成、編集フォームへの入力、またはファイルアップロード

### レコード操作の操作

- 作成または編集フォームへ入力された項目値
- 編集対象のレコード ID
- 削除対象として選択されたレコード ID
- アップロード対象のファイル

### 検索・ソート・ページングの操作

- `metricKey`: `ObjectMetricCatalog` に定義されたカードキー
- `searchTerm`: `Name` 相当項目へ適用する検索語
- `sortBy`: 一覧で選択されたソート項目
- `sortDirection`: `asc` または `desc`
- `paginationCursor`: 初回はnull、継続取得では前回返された標準カーソル
- `startIndex`: 標準APIが返した取得位置。初回は0
- `pageNumber`: 画面に表示するページ番号

## エラー判定

2ページ目以降が空になった場合は、そのページに表示できるレコードがないことを案内し、前のページへ戻れます。

フォームの起動前には接続・切断コールバックで保持した状態を確認します。`isConnected`プロパティの公開状態へ依存せず、画面離脱後は待機中のモーダルを開きません。

操作・取得処理と子部品の例外は各LWCのControllerで捕捉し、同じバンドルのLogicで診断情報を生成してHTML内に処理場所・種類を表示します。既存の業務エラーと操作可否は維持します。診断ログはエラー時だけ生成します。

- 想定内の状態を例外型で識別せず、下位層の判定結果と Controller の固定メッセージを境界にします。空の独自例外では公開可能なメッセージを保証できないため、`ObjectRecordSearchException` は使用しません。
- 未定義のカードキー、利用できないオブジェクト、参照不可の `Name` 相当項目、不正なページ取得位置は、Service が判定結果と原因コードで Controller へ返します。
- Controller は原因コードを利用者が次の操作を選べるメッセージへ対応付け、LWC の境界で `AuraHandledException` として返します。
- 内部の検索状態や検索条件が成立しない場合は処理を継続せず、Controller が内部エラーの詳細を公開しない一般化メッセージへ変換します。
- 予期しない検索、設定、削除エラーは操作別の一般化メッセージに変換します。
- 削除は部分成功を許容し、失敗した行ごとに一般化したエラーを返します。
- UI API の作成、編集エラーとファイルアップロードエラーはトーストまたはフォームメッセージで表示します。

### レコード操作のエラー

- 保存、アップロード、削除の処理結果と、その後の一覧再取得の成否は分けて扱います。再取得が失敗しても成功済みの操作を失敗と通知しません。
- 親への `recordschanged` 通知は一覧再取得より先に送ります。再取得失敗時は古い一覧と選択状態を破棄し、一覧取得エラーから手動再試行できます。
- 一覧再取得中は検索、ページ移動、保存、削除の操作を抑止します。

- 作成、編集エラーは標準フォームメッセージとモーダル内のアラートで表示し、その場で再入力できます。
- モーダル自体の起動失敗はトーストで表示し、再度開く操作を許可します。
- 削除は部分成功を許容し、DML失敗またはDMLへ到達しなかった要求IDごとに、権限または関連データの確認を促す一般化メッセージを返します。
- 予期しない削除エラーは操作全体の一般化メッセージへ変換します。

### 検索・ソート・ページングのエラー

- 未定義のカードキー、利用不能なオブジェクト・項目は利用者向けエラーにします。
- 負の取得位置と、カーソルなしで先頭以外を要求した場合は拒否します。
- カーソル失効などの取得失敗では古い一覧を消し、再読み込みで先頭から取得できます。
- 検索条件変更後の先頭ページ取得が失敗した場合も、その条件のwire応答を再読み込みに使用します。再取得が失敗した場合は操作待ちを解除し、再読み込みや検索をやり直せます。
- 予期しない例外は一般化した検索エラーとして表示します。

## 処理詳細

1. `metricKey` から対象オブジェクトを解決し、オブジェクトと `Name` 相当項目の参照、検索、作成、更新、削除可否を Describe で取得します。
2. オブジェクト別の固定表示項目から、利用者が参照できる項目だけを一覧列にします。
3. 検索、ソート、ページ移動を処理します。詳細は [検索・ソート・ページング](#検索ソートページング) を参照してください。
4. 権限とオブジェクト別の対応状況に応じて、作成、編集、削除、ファイルアップロードを処理します。詳細は [レコード操作](#レコード操作) を参照してください。
5. レコード変更後は親のデータボードへ `recordschanged` イベントを通知し、一覧を再読み込みします。

### レコード操作

`objectRecordSearch` におけるレコードの作成、編集、削除、ファイルアップロードの詳細仕様です。

### 作成・編集

画面を離れた後に返ったフォームの保存結果やエラーは、再接続先の一覧・通知・新しく開いたフォームに反映しません。

作成・編集とファイルアップロードは、`LightningModal` を継承した `objectRecordFormModal` で開きます。初期フォーカス、Tab・Shift+Tabの移動範囲、Escapeによる終了、閉じた後のフォーカス復帰は標準モーダルに委譲します。キャンセル時は一覧を再取得しません。

1. UI Object Info APIからオブジェクト情報とデフォルトレコードタイプを取得します。
2. 作成用は利用者のデフォルトレコードタイプ、編集用は一覧取得時に権限を確認した対象レコードのレコードタイプから、Layout APIでFullレイアウトを取得します。既存行のレコードタイプが未指定の場合はMasterを明示し、利用者のデフォルトタイプへ置き換えません。編集対象のオブジェクト・レコードタイプと取得済みの編集レイアウトが一致することを確認し、一致する応答が確定してからモーダルを開きます。編集を閉じた直後の別レコードの編集でも、前のレイアウトを流用しません。編集対象がない間はデフォルトタイプの編集レイアウトを先行取得します。応答と読込状態を分け、各モードの項目権限から新規作成と編集の可否を独立して判定します。
3. レイアウト上の項目から、作成時は作成可能、編集時は更新可能な標準項目だけを `lightning-record-edit-form` に表示します。カスタム項目はフォーム対象外です。
4. レイアウト取得に失敗した場合、Account、Contact、Lead、Opportunityは定義済み項目へフォールバックします。それ以外のフォーム対応オブジェクトは、利用可能であれば `Name` 相当項目へフォールバックします。
5. 保存成功後に選択状態を解除して親コンポーネントへ変更を通知し、一覧を再読み込みします。

### ファイルアップロード

`ContentDocument` ではレコードフォームを使用せず、標準ファイルアップロードを表示します。アップロード完了後に一覧と親の件数を更新します。

### 削除

1. 選択されたレコード ID を、カードキーに対応するオブジェクトから `USER_MODE` で再取得します。
2. `Database.delete` を `allOrNone=false`、`AccessLevel.USER_MODE` で実行します。
3. 成功件数と失敗行の一般化メッセージを返します。重複、対象外、取得不能により削除DMLへ到達しなかったIDも失敗として扱います。Apex呼び出しが完了した場合は、部分成功や0件成功を含めて一覧と親の件数を更新します。

### 実装上の責務

削除DMLは`ObjectRecordSearchController`が実行し、Serviceは対象可否と削除結果の集計を担当します。編集モーダルには項目構成と同じレコードタイプを渡します。編集レイアウトの待機中に画面を離れた場合は、応答後にモーダルを表示しません。

### 検索・ソート・ページング

`objectRecordSearch` の一覧を、Apex標準の `Database.PaginationCursor` でページ取得します。

### 関連情報

- [Apex Developer Guide: Pagination Cursors](https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/salesforce_apex_developer_guide.pdf)

1. カードキーから許可済みオブジェクトを解決し、Describeで参照権限と項目を確認します。
2. 検索語の前後空白を除去し、検索可能なName相当項目に部分一致条件を設定します。検索語はbind値で渡します。
3. ソート項目をName相当項目または参照可能でソート可能な追加項目に限定します。
4. 初回は `Database.getPaginationCursorWithBinds` を `AccessLevel.USER_MODE` で呼び出します。並び順は `ORDER BY <指定項目> ASC/DESC NULLS LAST, Id ASC`で、取得上限を設定します。
5. 継続取得では標準カーソルの `fetchPage(startIndex, fetchSize)` を使い、ページサイズを上限に取得します。独自のソート値比較WHERE条件やOFFSETは使用しません。
6. `CursorFetchResult.getNextIndex()` を次の取得位置に使用します。カーソル件数と取得位置から次ページ有無を判定します。

検索・ソート条件変更時はカーソルとページ履歴を初期化します。再読み込み、保存・削除後の更新では先頭ページのwireを `refreshApex` し、結果集合を作り直します。応答待ちの間は追加の検索・ページ操作を抑止します。同一条件の再操作では新しい応答待ちを開始しません。

### レコード操作の制約・注意事項

- `EmailMessage` は汎用作成、編集フォームの対象外です。
- `ContentDocument` は標準ファイルアップロードだけを提供します。`record-id` は指定しないため、特定レコードへの関連付けは行いません。
- フォールバックの複数項目定義はAccount、Contact、Lead、Opportunityだけです。その他のフォーム対応オブジェクトは `Name` 相当項目だけを使用します。
- 作成、編集フォームはページレイアウトに含まれる更新可能な標準項目だけを対象とし、カスタム項目は表示しません。
- オブジェクトが作成可能または更新可能でも、利用可能なフォーム項目がない場合は操作できません。

### 権限とデータ更新

- 作成と編集はLightning UI API、削除はApexの `AccessLevel.USER_MODE` を使用するため、操作ごとに適用経路が異なります。
- 削除は `allOrNone=false` の部分成功を許容し、Apex呼び出し完了後に削除結果を表示して一覧と親の件数を更新します。
- ファイルアップロードは標準 `lightning-file-upload` の実行権限とSalesforce標準動作に依存します。

### 検索・ソート・ページングの制約・注意事項

- 1ページは50件固定です。検索対象はName相当項目のみです。
- 標準PaginationCursorの上限に合わせて最大100,000件を取得します。上限到達時には検索条件を絞る案内を表示します。全件を表示できたとは断定しません。
- ページ番号は表示用であり、取得位置の計算には使いません。
- 標準カーソルの有効期間とAPI制限に従います。データ変更後は再読み込みが必要です。
- ソート不可項目を直接Apexへ指定した場合は、Name相当項目へフォールバックします。

### レコード操作の既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装はレコード操作関連Apexクラスと `objectRecordSearch` のフォーム・削除処理、代表テストから確認しています。
- 承認済み要求またはレコード操作要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。

### 検索・ソート・ページングの既知の差異・確認事項

- ページ取得は標準PaginationCursorへ統一しています。独自の境界値比較による取得制御はありません。
- 取得上限を超える結果と標準カーソルの有効期間はSalesforceの制約に従います。無制限の全件取得は保証しません。

### 制約・注意事項

- 検索対象は [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls) に定義されたオブジェクトだけです。
- 検索とページングの制約は [検索・ソート・ページング](#検索ソートページング) に記載します。
- 作成、編集、削除、ファイルアップロードの制約は [レコード操作](#レコード操作) に記載します。

### 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装は `objectRecordSearch`、関連Apexクラス、Apexテスト、Jestテストから確認しています。
- 承認済み要求または画面要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。

### テストコード

[テストコードと確認内容](tests.md)
