# 取引先データ品質スキャンのテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- [AccountDataQualityScanServiceTest](../../../../force-app/main/default/classes/AccountDataQualityScanServiceTest.cls): 各不足条件、累積、完了、失敗、禁止状態遷移
- [AccountDataQualityScanSelectorTest](../../../../force-app/main/default/classes/AccountDataQualityScanSelectorTest.cls): USER_MODE Cursor、分割取得、管理レコードI/O、一意制約
- [AccountDataQualityScanQueueableTest](../../../../force-app/main/default/classes/AccountDataQualityScanQueueableTest.cls): 0件、1区間完了、端数区間、複数段の連鎖、入力不足の拒否、Finalizerの失敗記録
- [AccountDataQualityScanControllerTest](../../../../force-app/main/default/classes/AccountDataQualityScanControllerTest.cls): 初期表示、開始、分割境界をまたぐ完了、重複開始拒否、直近結果、参照拒否応答で取得・保存・非同期登録が行われないこと
- `accountDataQualityScan.test.js`: 画面状態、開始、手動更新、エラー、権限不足時の結果非表示・開始抑止・回復、アクセシビリティ
- `accountDataQualityScanLogic.test.js`: 状態ラベル、操作可否、表示値の正規化

組織上ではCursorのQueueable間シリアライズ、Permission Setを割り当てた利用者権限、Queueable連鎖、Finalizerによる失敗記録を確認します。

### 画面操作を再現するテスト

| テストファイル                                                                                                                                     | 代表的な確認内容                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [accountDataQualityScan.test.js](../../../../force-app/main/default/lwc/accountDataQualityScan/__tests__/accountDataQualityScan.test.js)           | 履歴がない場合に最初のスキャン開始を案内する。処理中スキャンの進捗と不足件数を表示する。                                 |
| [accountDataQualityScanLogic.test.js](../../../../force-app/main/default/lwc/accountDataQualityScan/__tests__/accountDataQualityScanLogic.test.js) | 履歴がない場合は表示モデルを作成しない。完了スキャンを再実行可能な表示モデルへ変換する。                                 |
| [localError.test.js](../../../../force-app/main/default/lwc/accountDataQualityScan/__tests__/localError.test.js)                                   | 画面固有の処理位置と例外の分類を維持する。                                                                               |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)                                   | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。 |
| [salesforceApiUtils.test.js](../../../../force-app/main/default/lwc/salesforceApiUtils/__tests__/salesforceApiUtils.test.js)                       | ApexとUI APIの異なる応答形式を入力順で表示する。応答がない場合の既存メッセージと代替文言の優先順位を維持する。           |
