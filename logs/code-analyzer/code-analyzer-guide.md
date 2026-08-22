# Code Analyzer ログガイド

`logs/code-analyzer/` は、Salesforce Code Analyzer のローカル解析結果の出力先です。

`sf code-analyzer run --output-file` で生成した解析結果ファイルは Git 管理しません。このガイドだけを Git 管理し、Code Analyzer の出力先フォルダ名を固定します。

このリポジトリの npm scripts は `--target force-app` で解析対象を Salesforce ソースに限定し、`--output-file` で `logs/code-analyzer/` 配下を指定しています。そのため、以下のコマンドを実行すると `force-app` の解析結果が同ディレクトリに生成されます。Aura、LWC、`scripts/**/*.js` の JavaScript は `npm run lint` で解析します。

## 使いどころ

Salesforce Code Analyzer のローカル実行結果を残すときに使います。通常の確認は `local.json`、CI 相当の確認は `ci.json` に出力します。

## ローカル確認

```sh
npm run code-analyzer
```

出力先:

```text
logs/code-analyzer/local.json
```

`local.json` は手元で内容を確認するための解析結果です。

## CI 相当の確認

```sh
npm run code-analyzer:ci
```

出力先:

```text
logs/code-analyzer/ci.json
```

`ci.json` は severity threshold 付きの CI 相当確認で使います。

## 対象を限定した確認

変更ファイルだけを解析するなど、`sf code-analyzer run` を直接実行する場合は、解析対象を `--target` で明示し、解析結果と実行ログの両方を `logs/code-analyzer/` 配下へ保存します。

```sh
sf code-analyzer run \
  --rule-selector Recommended \
  --target force-app/main/default/classes/Example.cls \
  --output-file logs/code-analyzer/scoped.json \
  --include-fixes \
  2>&1 | tee logs/code-analyzer/scoped.log
```

外部取得物のコマンド例が `./code-analyzer-results-*` を指定していても、このリポジトリでは使用しません。出力先だけを `logs/code-analyzer/` 配下へ置き換えます。

`--output-file` の拡張子を変えると、HTML、CSV、XML、SARIF などの形式でも出力できます。

## ローカル解析結果の削除

削除対象を事前確認する:

```sh
git clean -ndX logs/code-analyzer
```

生成済みの Code Analyzer 解析結果を削除する:

```sh
git clean -fdX logs/code-analyzer
```

`git clean -fdX` は ignore 対象だけを削除するため、このガイドは残ります。
