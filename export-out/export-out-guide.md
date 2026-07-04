# export-out ガイド

`export-out/` は、Salesforce CLI の export 出力先として使うローカルフォルダです。

`sf data export bulk` で生成した CSV / JSON ファイルは Git 管理しません。このガイドだけを Git 管理し、出力先フォルダ名を `export-out/` に固定します。

## CSV

```sh
sf data export bulk \
  --query-file scripts/soql/test-data-check-queries/accounts.soql \
  --output-file export-out/accounts.csv \
  --result-format csv \
  --wait 30 \
  --target-org <alias>
```

## JSON

```sh
sf data export bulk \
  --query-file scripts/soql/test-data-check-queries/accounts.soql \
  --output-file export-out/accounts.json \
  --result-format json \
  --wait 30 \
  --target-org <alias>
```

標準オブジェクトの初期データセットアップ手順は [test-data-import.md](../docs/deployment/test-data-import.md) を参照してください。

## ローカル export 結果の削除

削除対象を事前確認する:

```sh
git clean -ndX export-out
```

生成済みの export 結果を削除する:

```sh
git clean -fdX export-out
```

`git clean -fdX` は ignore 対象だけを削除するため、このガイドは残ります。
