# テストデータ一括削除画面のテストコード

[機能仕様に戻る](index.md)

## 確認する振る舞い

- [TestDataDeleteControllerTest](../../../../force-app/main/default/classes/TestDataDeleteControllerTest.cls): 実効権限による拒否、確認なしの拒否、正規受付、重複起動、指定ジョブの取得。
- [TestDataDeleteServiceTest](../../../../force-app/main/default/classes/TestDataDeleteServiceTest.cls): 対象外照会、全ファイル照会権限なしでの計画生成、実行環境。
- [TestDataDeleteSelectorTest](../../../../force-app/main/default/classes/TestDataDeleteSelectorTest.cls): 削除済みを除く件数、未指定IDの検索抑止。
- `testDataDelete.test.js`: 確認キャンセル、二重起動、権限・通信失敗、受付不明、アクセシビリティ。
- `testDataDeleteLogic.test.js`: 未確認とゼロ件の区別、別ジョブとの混同防止、全体状態。

### 画面操作を再現するテスト

| テストファイル                                                                                                             | 代表的な確認内容                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [lwcLoggerUtils.test.js](../../../../force-app/main/default/lwc/lwcLoggerUtils/__tests__/lwcLoggerUtils.test.js)           | 本文・接続先・端末パスを除き、フレームの重複と件数を制限する。スタックが欠落しても呼び出し元の種類と固定位置を維持する。     |
| [localError.test.js](../../../../force-app/main/default/lwc/testDataDelete/__tests__/localError.test.js)                   | 画面固有の処理位置と例外の分類を維持する。                                                                                   |
| [testDataDelete.test.js](../../../../force-app/main/default/lwc/testDataDelete/__tests__/testDataDelete.test.js)           | 再接続前の確認が成立しても送信せず、新しい確認のロックを維持する。送信後の再接続では受付結果を待ち、削除を二重に開始しない。 |
| [testDataDeleteLogic.test.js](../../../../force-app/main/default/lwc/testDataDelete/__tests__/testDataDeleteLogic.test.js) | 未取得をゼロ件と扱わない。全対象を確認してから実行を許可する。                                                               |
