# テストデータ削除バッチのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

- `TestDataDeleteBatchTest`: 単一スコープの一括削除、分割境界をまたぐ直接呼び出しによる集計維持、次バッチの登録、子の残存による停止、不正計画の拒否。
- `TestDataDeleteBatchServiceTest`: 本番・権限拒否、部分失敗、未処理例外、残存、新しい対象への状態遷移。
- `TestDataDeleteBatchSelectorTest`: 全対象のクエリ、ごみ箱除外。
- `TestDataDeleteBatchWrapperTest`: 依存順序と対象外オブジェクトの保護。

## 対応するテストクラス

- [TestDataDeleteBatchSelectorTest.cls](../../../../../force-app/main/default/classes/TestDataDeleteBatchSelectorTest.cls)
- [TestDataDeleteBatchServiceTest.cls](../../../../../force-app/main/default/classes/TestDataDeleteBatchServiceTest.cls)
- [TestDataDeleteBatchTest.cls](../../../../../force-app/main/default/classes/TestDataDeleteBatchTest.cls)
- [TestDataDeleteBatchWrapperTest.cls](../../../../../force-app/main/default/classes/TestDataDeleteBatchWrapperTest.cls)
- [TestDataDeleteServiceTest.cls](../../../../../force-app/main/default/classes/TestDataDeleteServiceTest.cls)
