# 取引先一括削除の定期実行のテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

`AccountDeleteBatchSchedulerTest`では、実際の組織環境に応じた定期起動の受付・拒否と、実行を拒否した場合の通知・追加登録防止を確認します。実行者は標準システム管理者とし、追加ユーザーによる権限差異のテストは行いません。必要なカスタム権限は、既存の権限セット名に依存せずテスト内で準備します。実際の周期・実行ユーザー・メール配信は対象組織で別途確認します。

## 対応するテストクラス

- [AccountDeleteBatchSchedulerTest.cls](../../../../../force-app/main/default/classes/AccountDeleteBatchSchedulerTest.cls)
