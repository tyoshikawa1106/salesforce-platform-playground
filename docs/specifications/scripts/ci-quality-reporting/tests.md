# 定期品質チェック結果報告スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

`scripts/ci/test/report-quality-check.node.js`で、対象外結果、初回失敗、継続失敗、復旧、対応Issueなし、JSON不正、GitHub CLI失敗、JST日時、古いコミットの成功・失敗を反映しないこと、mainのSHA取得失敗を確認します。

```sh
node --test scripts/ci/test/report-quality-check.node.js
```

## テストファイルと代表的なケース

| ファイル                                                                                 | 確認内容                                                              |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [report-quality-check.node.js](../../../../scripts/ci/test/report-quality-check.node.js) | JST日時を固定形式で表示する。対象外の結果ではGitHub CLIを実行しない。 |
