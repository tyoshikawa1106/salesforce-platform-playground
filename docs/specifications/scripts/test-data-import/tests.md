# テストデータ投入スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

`scripts/setup/test/*.node.js`で、引数、リポジトリ外パス拒否、planとApex構成、dry-run、対象組織、承認、本番禁止、CLI失敗、一時ファイル削除を確認します。

```sh
node --test scripts/setup/test/*.node.js
```

## テストファイルと代表的なケース

| ファイル                                                                                          | 確認内容                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [import-test-data-core.node.js](../../../../scripts/setup/test/import-test-data-core.node.js)     | CLI引数を型付きの設定へ変換する。値が必要なCLIオプションを値なしで指定できない。                                                   |
| [import-test-data-runner.node.js](../../../../scripts/setup/test/import-test-data-runner.node.js) | dry-runでは一時ファイルとSalesforce CLIを使用せず実行予定を表示する。実投入ではCLIの要約を表示し、成功後に一時ファイルを削除する。 |
| [import-test-data.node.js](../../../../scripts/setup/test/import-test-data.node.js)               | dry-runではSalesforce CLIと入力確認を実行しない。ローカルのplan検証に失敗した場合は組織確認と入力確認を開始しない。                |
