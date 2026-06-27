# code-analyzer-results ガイド

`code-analyzer-results/` は、Salesforce Code Analyzer のローカル出力先です。

`sf code-analyzer run --output-file` で生成した解析結果ファイルは Git 管理しません。このガイドだけを Git 管理し、Code Analyzer の出力先フォルダ名を `code-analyzer-results/` に固定します。

## ローカル確認

```sh
npm run code-analyzer
```

出力先:

```text
code-analyzer-results/local.json
```

## CI 相当の確認

```sh
npm run code-analyzer:ci
```

出力先:

```text
code-analyzer-results/ci.json
```

`--output-file` の拡張子を変えると、HTML、CSV、XML、SARIF などの形式でも出力できます。
