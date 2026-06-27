# Code Analyzer ログガイド

`logs/code-analyzer/` は、Salesforce Code Analyzer のローカル解析結果の出力先です。

`sf code-analyzer run --output-file` で生成した解析結果ファイルは Git 管理しません。このガイドだけを Git 管理し、Code Analyzer の出力先フォルダ名を固定します。

このリポジトリの npm scripts は `--output-file` で `logs/code-analyzer/` 配下を指定しているため、以下のコマンドを実行すると同ディレクトリに結果ファイルが生成されます。

## ローカル確認

```sh
npm run code-analyzer
```

出力先:

```text
logs/code-analyzer/local.json
```

## CI 相当の確認

```sh
npm run code-analyzer:ci
```

出力先:

```text
logs/code-analyzer/ci.json
```

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
