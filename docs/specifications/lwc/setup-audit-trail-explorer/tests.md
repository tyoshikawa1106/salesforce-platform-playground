# 設定変更履歴エクスプローラーのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

`setupAuditTrailExplorer.test.js` は各ダウンロード操作、ページ境界、ファイル名と CSV の内容を確認します。`setupAuditTrailExplorerLogic.test.js` は日付をまたぐ時刻、セル内改行、Unicode 文字を確認します。`SetupAuditTrailExplorerSelectorTest` と `SetupAuditTrailExplorerServiceTest` は検索条件とページ処理を検証します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                                        | 代表的な確認内容                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [setupAuditTrailExplorer.test.js](../../../../force-app/main/default/lwc/setupAuditTrailExplorer/__tests__/setupAuditTrailExplorer.test.js)           | 権限を確認できるまで履歴・分析・CSVの操作と取得を開始しない。権限照会の通信失敗と再接続前の古い許可応答で機能を開かない。 |
| [setupAuditTrailExplorerLogic.test.js](../../../../force-app/main/default/lwc/setupAuditTrailExplorer/__tests__/setupAuditTrailExplorerLogic.test.js) | 対象月を保持し、利用者のタイムゾーンで出力日時を付ける。escapes metadata labels that contain CSV separators。             |
