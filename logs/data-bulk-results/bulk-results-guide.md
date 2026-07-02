# Bulk データ結果ログガイド

`logs/data-bulk-results/` は、`sf data bulk results` のローカル出力先です。

`sf data bulk results` には出力先ディレクトリを指定する flag がありません。結果 CSV はコマンドを実行したディレクトリに生成されます。

このリポジトリでは、生成された結果 CSV を `logs/data-bulk-results/` に置きます。結果 CSV は Git 管理しません。このガイドだけを Git 管理します。

## 使いどころ

Bulk API 2.0 の import / update / upsert / delete の完了後、成功・失敗・未処理レコードの結果 CSV を取得するときに使います。

## job ID

`<job-id>` は、`sf data import bulk`、`sf data update bulk`、`sf data upsert bulk`、`sf data delete bulk` などの Bulk API 2.0 ingest コマンドを実行したときの出力に表示されます。

```sh
sf data import bulk --file <csv-file> --sobject <sobject> --target-org <alias>
```

実行結果に表示された `Job ID` / `jobId` を控えて、結果取得時の `--job-id` に指定します。`--json` を付けて実行すると `jobId` を確認しやすくなります。

## コマンド

repo root から実行します。

```sh
npm run data:bulk:results -- --job-id <job-id> --target-org <alias>
```

`package.json` の npm script 内で `logs/data-bulk-results/` に移動して実行します。`cd` は npm の子プロセス内だけで有効なため、実行後に作業ディレクトリを戻す必要はありません。

出力される CSV の名前は Salesforce CLI が決めます。結果確認後に必要な CSV だけを開きます。

## 削除

削除対象を確認する:

```sh
git clean -ndX logs/data-bulk-results
```

生成済みの結果 CSV を削除する:

```sh
git clean -fdX logs/data-bulk-results
```

`git clean -fdX` は ignore 対象だけを削除するため、このガイドは残ります。
