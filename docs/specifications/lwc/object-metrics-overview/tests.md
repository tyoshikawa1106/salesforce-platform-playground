# データボードのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- [ObjectMetricCatalogTest](../../../../force-app/main/default/classes/ObjectMetricCatalogTest.cls)で、カード定義の順序、キーとオブジェクトの対応、許可対象、返却一覧の独立性を確認すること

- [ObjectMetricsOverviewControllerTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewControllerTest.cls)、[ObjectMetricsOverviewQueryRunnerTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewQueryRunnerTest.cls)、[ObjectMetricsOverviewServiceTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewServiceTest.cls)、[ObjectMetricsOverviewSelectorTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewSelectorTest.cls) で、カタログ順、主要オブジェクトの実件数、0件、不明なAPI名、例外、クエリ数、集計上限の境界を確認すること
- `objectMetricsOverview.test.js` で、初期表示、読込中、件数表示、上限表示、エラー、再読み込み、カード選択、検索画面からの復帰を確認すること
- ホームページ上でカードの表示順、ラベル、アイコン、レスポンシブ表示を確認します。
- Apexではメタデータの存在・参照可否と残りSOQL数を内部引数で指定し、未取得と正常な0件を区別します。件数取得計画の上限は内部コンストラクタへ2を渡し、2件の受付と3件の拒否を検証します。通常の上限は50件です。

### 画面操作を再現するテスト

| テストファイル                                                                                                                                  | 代表的な確認内容                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                                | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。             |
| [localError.test.js](../../../../force-app/main/default/lwc/objectMetricsOverview/__tests__/localError.test.js)                                 | 画面固有の処理位置と例外の分類を維持する。                                                                                           |
| [objectMetricsOverview.test.js](../../../../force-app/main/default/lwc/objectMetricsOverview/__tests__/objectMetricsOverview.test.js)           | 初回描画からカード名とアイコンを表示し、件数応答を同じカードへ反映する。空結果の再取得中もカードを先行表示し、完了したら応答に従う。 |
| [objectMetricsOverviewLogic.test.js](../../../../force-app/main/default/lwc/objectMetricsOverview/__tests__/objectMetricsOverviewLogic.test.js) | 先行表示の全カードがApexカタログの順序・キー・名前・アイコンに一致する。Apex応答を画面管理用の件数項目へ正規化する。                 |
| [localBusinessError.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/localBusinessError.test.js)                    | トーストの空要素を除き改行と代替文言を維持する。                                                                                     |
| [localError.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/localError.test.js)                                    | 画面固有の処理位置と例外の分類を維持する。                                                                                           |
| [objectRecordSearch.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearch.test.js)                    | renders searched records with a standard record URL。deletes selected rows through Apex。                                            |
| [objectRecordSearchDisplay.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchDisplay.test.js)      | 日時列に時分を表示し、日付列には時刻を加えない。ソート可否が明示された列だけソート操作を表示する。                                   |
| [objectRecordSearchForm.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchForm.test.js)            | returns object-specific form capabilities。selects the current UI API layout for the object and mode。                               |
| [objectRecordSearchFormFlow.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchFormFlow.test.js)    | isConnectedが公開されない環境でも接続中は作成モーダルを開く。作成可能項目がなくても更新可能なレコードを編集できる。                  |
| [objectRecordSearchLogic.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchLogic.test.js)          | 画面状態からApex検索要求を生成する。Apex検索成功応答を一覧とページング状態へ変換する。                                               |
| [objectRecordSearchPaging.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchPaging.test.js)        | refreshes failed new criteria instead of the previous successful search。unlocks retry when refreshing a later page fails。          |
| [objectRecordSearchState.test.js](../../../../force-app/main/default/lwc/objectRecordSearch/__tests__/objectRecordSearchState.test.js)          | creates default pagination and sort state values。creates pagination state from response and page navigation values。                |
| [salesforceApiUtils.test.js](../../../../force-app/main/default/lwc/salesforceApiUtils/__tests__/salesforceApiUtils.test.js)                    | ApexとUI APIの異なる応答形式を入力順で表示する。応答がない場合の既存メッセージと代替文言の優先順位を維持する。                       |
