# 文書検査スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

`npm run test:scripts`に含まれる`scripts/documentation-check/test/*.node.js`で、Git管理対象と未追跡・非除外の列挙条件、削除済み文書の除外、対象分類、H1、見出し、コードフェンス、リンク、URLエンコード、アンカー、索引到達性、安全でないコマンド例を確認します。

文書変更後は次を実行します。

```sh
npm run docs:check
```

## テストファイルと代表的なケース

| ファイル                                                                                            | 確認内容                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [markdown-files.node.js](../../../../scripts/documentation-check/test/markdown-files.node.js)       | 現行文書を検査対象に含め、外部取得物と履歴文書を除外する。Git管理対象と未追跡・非除外のMarkdownを列挙する。                |
| [validate-docs.node.js](../../../../scripts/documentation-check/test/validate-docs.node.js)         | リンク、アンカー、docs indexからの到達性をまとめて検証する。不正なURLエンコードをリンク元の問題として報告する。            |
| [validate-markdown.node.js](../../../../scripts/documentation-check/test/validate-markdown.node.js) | Markdownの見出し、重複アンカー、ローカルリンクを解析する。コードフェンス内の見出しを無視し、見出しレベルの飛びを報告する。 |
