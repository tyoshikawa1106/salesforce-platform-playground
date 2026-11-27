# 汎用レコード検索のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

`ObjectRecordSearchControllerTest`では内部検索フローへ取得件数2件を渡し、取引先3件でページ継続・カーソルのJSON往復・先頭への復帰を確認します。画面から呼び出すApexメソッドは50件を固定し、内部問い合わせは1〜50件のみ許可します。実行者は標準システム管理者とし、プロファイル名に依存する権限拒否のテストは行いません。

- [ObjectRecordSearchFieldCatalogTest](../../../../force-app/main/default/classes/ObjectRecordSearchFieldCatalogTest.cls)で、固定表示列の順序、表示型、ソート可否、未定義オブジェクトの扱いを確認すること

- [ObjectRecordSearchControllerTest](../../../../force-app/main/default/classes/ObjectRecordSearchControllerTest.cls)、[ObjectRecordSearchSelectorTest](../../../../force-app/main/default/classes/ObjectRecordSearchSelectorTest.cls)、[ObjectRecordSearchServiceTest](../../../../force-app/main/default/classes/ObjectRecordSearchServiceTest.cls) で、設定取得、検索語の正規化、任意フィルターなしの初期一覧、ページング、削除、不正入力を確認すること
- [ObjectRecordSearchSelectorTest](../../../../force-app/main/default/classes/ObjectRecordSearchSelectorTest.cls)、[ObjectRecordSearchQueryPlanTest](../../../../force-app/main/default/classes/ObjectRecordSearchQueryPlanTest.cls)、[ObjectRecordSearchSortSupportTest](../../../../force-app/main/default/classes/ObjectRecordSearchSortSupportTest.cls) で、動的 SOQL と bind、許可済み検索条件、取得件数の許容範囲、昇順・降順ソート、カーソル、不正ページ取得位置を確認すること
- `objectRecordSearch.test.js`、`objectRecordSearchPaging.test.js`、`objectRecordSearchFormFlow.test.js` で、一覧表示、検索、ページ移動、レコード操作、権限メッセージ、エラー、親イベント通知を確認すること
- 対応する各オブジェクトで `Name` 相当項目と追加表示項目が正しく表示されることを確認します。
- 権限の異なるユーザーでボタン状態、表示列、検索、各 DML を確認します。

### レコード操作

- `ObjectRecordSearchControllerTest`、`ObjectRecordSearchSelectorTest`、`ObjectRecordSearchServiceTest` で、削除要求、USER_MODE削除、成功件数、空入力、不正IDを確認すること
- `objectRecordSearch.test.js`、`objectRecordSearchFormFlow.test.js`、`objectRecordSearchForm.test.js` で、権限制御、フォーム構築、保存、ファイルアップロード、部分失敗、親イベント通知を確認すること
- 作成、更新、削除権限に応じて各操作が有効または無効になること
- 作成可能な項目がなくても、編集レイアウトに更新可能な項目があれば編集できること
- 作成用と編集用の応答順に依存せず、取得済みモードの操作を許可し、項目がないモードだけを無効化すること
- 作成と編集で適切なレイアウトおよび必須項目を表示すること
- 利用者のデフォルトがカスタムレコードタイプでも、Masterの既存行はMasterのレイアウトと必須条件で編集し、編集を閉じた後の新規作成はデフォルトタイプを使うこと
- Masterの編集を閉じて既定タイプの行を続けて編集した場合、応答の速さによらず既定タイプの項目と必須条件を使うこと
- レイアウト取得失敗時に定義済み項目へフォールバックすること
- 作成、編集、アップロード成功後に一覧と親の件数を更新すること
- モーダルの入力・保存・キャンセルと親への結果返却をJestで確認すること。標準モーダルのフォーカス制御はJest mockでは再現せず、組織上で新規・編集・アップロードそれぞれのキーボード操作を確認すること
- 複数レコード削除で成功件数と部分失敗を正しく表示し、0件成功の場合は成功トーストを表示しないこと
- 削除不可、ID未選択、不正IDの操作を安全に処理すること

### 検索・ソート・ページング

- `ObjectRecordSearchControllerTest` で設定順と字句順が異なる商談フェーズ、Booleanの両値、同値のページ境界、nullを含む一覧を検証します。
- 全ページを連結したIDと順序を同じORDER BYの結果と比較します。標準カーソルのJSON往復と先頭ページへの復帰も確認します。
- Controller、Service、Selector、QueryPlan、SortSupportの関連テストで検索語、権限、ソート指定、不正な取得位置と空結果を確認します。
- LWCテストでサーバーへのソート指定、前後ページ、検索条件変更、再読み込み、日時表示、操作待機と失敗後の復帰を確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                                  | 代表的な確認内容                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                                | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。    |
| [localError.test.js](../../../../force-app/main/default/lwc/objectRecordFormModal/__tests__/localError.test.js)                                 | 画面固有の処理位置と例外の分類を維持する。                                                                                  |
| [objectRecordFormModal.test.js](../../../../force-app/main/default/lwc/objectRecordFormModal/__tests__/objectRecordFormModal.test.js)           | 閉じる処理の失敗をモーダル内に表示する。検証処理で例外になった場合はフォームの標準送信を止める。                            |
| [objectRecordFormModalLogic.test.js](../../../../force-app/main/default/lwc/objectRecordFormModal/__tests__/objectRecordFormModalLogic.test.js) | 保存エラーの詳細を優先し、詳細がなければ対象名を使う。                                                                      |
| [localBusinessError.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/localBusinessError.test.js)                    | トーストの空要素を除き改行と代替文言を維持する。                                                                            |
| [localError.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/localError.test.js)                                    | 画面固有の処理位置と例外の分類を維持する。                                                                                  |
| [objectRecordSearch.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearch.test.js)                    | renders searched records with a standard record URL。deletes selected rows through Apex。                                   |
| [objectRecordSearchDisplay.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchDisplay.test.js)      | 日時列に時分を表示し、日付列には時刻を加えない。ソート可否が明示された列だけソート操作を表示する。                          |
| [objectRecordSearchForm.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchForm.test.js)            | returns object-specific form capabilities。selects the current UI API layout for the object and mode。                      |
| [objectRecordSearchFormFlow.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchFormFlow.test.js)    | isConnectedが公開されない環境でも接続中は作成モーダルを開く。作成可能項目がなくても更新可能なレコードを編集できる。         |
| [objectRecordSearchLogic.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchLogic.test.js)          | 画面状態からApex検索要求を生成する。Apex検索成功応答を一覧とページング状態へ変換する。                                      |
| [objectRecordSearchPaging.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchPaging.test.js)        | refreshes failed new criteria instead of the previous successful search。unlocks retry when refreshing a later page fails。 |
| [objectRecordSearchState.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchState.test.js)          | creates default pagination and sort state values。creates pagination state from response and page navigation values。       |
| [salesforceApiUtils.test.js](../../../../force-app/main/default/lwc/salesforceApiUtils/__tests__/salesforceApiUtils.test.js)                    | ApexとUI APIの異なる応答形式を入力順で表示する。応答がない場合の既存メッセージと代替文言の優先順位を維持する。              |
