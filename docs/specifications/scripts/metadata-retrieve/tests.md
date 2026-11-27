# メタデータ取得スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

`scripts/metadata/retrieve/test/retrieve.node.js`を次のコマンドで実行します。

```sh
node --test scripts/metadata/retrieve/test/retrieve.node.js
```

主な確認観点は次のとおりです。

- すべての分割manifestが実行対象に含まれる
- manifestの構造とAPI versionを取得開始前に確認する
- `StandardValueSet`、`EmailTemplate`、`EmailFolder`、`EmailTemplateFolder`に空でない具体名を重複なく指定し、メールテンプレート名にフォルダ名を含める
- 同じTarget Orgと`--wait 120`を全retrieveへ指定する
- warningでは後続を続行し、hard failureでは停止する
- 未完了または解析不能な応答を成功扱いしない
- 10,000件上限を要確認として扱う
- 長時間処理中に経過時間を表示し、完了後にタイマーを解除する

テストはSalesforce CLIと組織応答を模擬しています。実組織へのretrieve結果を検証するものではありません。

## テストファイルと代表的なケース

| ファイル                                                                        | 確認内容                                                                                            |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [retrieve.node.js](../../../../scripts/metadata/retrieve/test/retrieve.node.js) | retrieve scriptが分割manifestを重複なくすべて含む。分割manifestだけから取得計画を検証して集計する。 |
