# 取引先一括削除バッチのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

各実装に対応するテストクラスで、バッチの起動処理の受付・拒否、登録済みジョブの重複拒否、少数レコードによる部分成功とスコープ間の集計、0件通知、個人取引先有効時のContact連動削除、標準ジョブ検索を確認します。BatchServiceでは環境・カスタム権限・参照と削除の両方の権限の3つの判定値を引数で渡し、許可・各条件による拒否・拒否理由の優先順位を確認します。Batchでは拒否理由を引数で渡し、取引先1件が存在する状態で拒否時の空のQueryLocatorと許可時の対象取得を対応するテストクラスから検証します。バッチの起動処理では実際の組織環境・権限を必ず確認し、組織環境に応じて削除または対象の保持を検証します。

実行者は標準システム管理者とし、権限差異を作る追加ユーザーのテストは行いません。必要なカスタム権限は、既存の権限セット名に依存せずテストクラス内で準備します。

## 対応するテストクラス

- [AccountDeleteBatchSelectorTest.cls](../../../../../force-app/main/default/classes/AccountDeleteBatchSelectorTest.cls)
- [AccountDeleteBatchServiceTest.cls](../../../../../force-app/main/default/classes/AccountDeleteBatchServiceTest.cls)
- [AccountDeleteBatchTest.cls](../../../../../force-app/main/default/classes/AccountDeleteBatchTest.cls)
- [AccountDeleteBatchWrapperTest.cls](../../../../../force-app/main/default/classes/AccountDeleteBatchWrapperTest.cls)
- [OrgEnvironmentTest.cls](../../../../../force-app/main/default/classes/OrgEnvironmentTest.cls)
