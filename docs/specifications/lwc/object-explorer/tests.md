# オブジェクトエクスプローラーのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

ApexではCSV所有者数と項目監査の分割件数の境界を内部引数で2件に設定し、3件以内の未保存データで検証します。通常入口の上限はそれぞれ2,000件・200件です。更新前の接続失敗、定義取得失敗、定義の競合はHTTPモックで再現し、更新要求を送らないことを確認します。

Apexテストはシステム管理者プロファイルの現在ユーザーで実行します。テストのための権限セット割り当てや権限不足ユーザー作成は行いません。標準権限の分岐はメモリ上の実効権限レコードで確認します。

Apexは本体ごとの対応するテストクラスを恒久的に管理し、組織へ本体とともに反映します。HTTPモックで指定ログイン情報`InternalSalesforceApi`への接続先を検証し、認証情報には依存しません。HTTPモックによる標準・カスタム項目の保存、所有者ID照合、競合・部分失敗・権限を確認し、組織の限定scopeでコンパイル・テストを実行します。カバレッジは本体ごとに対応する対応するテストクラスの実行結果で確認します。LWCはLogic単体とコンポーネントの操作・表示・アクセシビリティを確認します。

- 起点・モード・種別の変更、カード選択、関連検索、項目フィルター、ページをまたぐ編集保持。
- CSVの出力と読取の往復、引用符・BOM・空行、列ずれ・重複・別対象・空欄による解除。
- CSVの件数・ファイルサイズ境界、分割した所有者ID照合、無効・不明・異なるIDの拒否、未保存入力と遅延応答の保持。
- 分類非対応の標準項目を一覧・CSV・保存入口で除外し、分類更新可能な日時項目を維持する判定。
- 標準・カスタム混在の保存、保存前の重複通信の省略、分割処理をまたぐCSV保存と失敗項目だけの再操作。
- 保存確認中・キャンセル時の固定スピナー非表示と、保存中の表示、成功・拒否・例外時の解除。
- 確認待ち・保存前の認証確認・分割保存中の離脱で後続を止め、再接続後の操作を古い応答で変更しないこと。
- 選択リスト順での分類表示と、廃止済み値の保持、表示順変更による誤った変更判定の防止。
- ChromeでCSV操作の配置・表示名・ヘルプを確認。実際の分類更新は検証対象と復元方法を限定した場合だけ実施。

### 画面操作を再現するテスト

| テストファイル                                                                                                                                                 | 代表的な確認内容                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                                               | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。 |
| [localDiagnostic.test.js](../../../../force-app/main/default/lwc/objectExplorer/__tests__/localDiagnostic.test.js)                                             | 画面固有の例外分類とログの処理位置を維持する。                                                                           |
| [objectExplorer.test.js](../../../../force-app/main/default/lwc/objectExplorer/__tests__/objectExplorer.test.js)                                               | 未選択の初期表示では照会せず、候補選択後に同じ対象を表示する。古い検索応答で最新の候補を上書きしない。                   |
| [objectExplorerLogic.test.js](../../../../force-app/main/default/lwc/objectExplorer/__tests__/objectExplorerLogic.test.js)                                     | 構造と分類のCSV名に利用者のタイムゾーンで出力日時を付ける。項目の絞り込みと再利用で入力を変更しない。                    |
| [objectExplorerReadOnly.test.js](../../../../force-app/main/default/lwc/objectExplorer/__tests__/objectExplorerReadOnly.test.js)                               | 編集権限がない利用者にも保存済み分類を表示し、編集と保存は許可しない。                                                   |
| [objectExplorerLookup.test.js](../../../../force-app/main/default/lwc/objectExplorerLookup/__tests__/objectExplorerLookup.test.js)                             | 検索と候補選択を値だけのイベントで親へ通知する。IME変換中は確定せず、キー移動にはDOMの座標だけを通知する。               |
| [setupAuditTrailExportModalLogic.test.js](../../../../force-app/main/default/lwc/setupAuditTrailExportModal/__tests__/setupAuditTrailExportModalLogic.test.js) | distinguishes a pending count from an empty result and formats the confirmed count。                                     |
