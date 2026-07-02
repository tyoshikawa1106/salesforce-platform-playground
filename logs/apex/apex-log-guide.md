# Apex ログガイド

`logs/apex/` は、Salesforce CLI で取得した Apex debug log のローカル出力先です。

`sf apex get log` で生成したログファイルは Git 管理しません。このガイドだけを Git 管理し、Apex debug log の出力先フォルダ名を固定します。

## 使いどころ

Apex、Flow、Trigger、Validation Rule などの org 上の実行ログを確認するときに使います。まずログ一覧で対象を探し、必要なログだけ `logs/apex/` に保存します。

## ログ一覧

```sh
sf apex list log --target-org <alias>
```

表示された `Id` を指定して、個別ログを取得できます。

## ログ保存

直近ログを保存する:

```sh
sf apex get log \
  --number 2 \
  --output-dir logs/apex \
  --target-org <alias>
```

指定ログを保存する:

```sh
sf apex get log \
  --log-id <log-id> \
  --output-dir logs/apex \
  --target-org <alias>
```

`--output-dir` を付けると、取得した debug log ファイルが `logs/apex/` に保存されます。

## tail の保存

リアルタイムにログを見る:

```sh
sf apex tail log --target-org <alias>
```

`sf apex tail log` には出力先 flag がないため、保存する場合は `tee` を使います。

```sh
sf apex tail log --target-org <alias> | tee logs/apex/apex-tail.log
```

## ローカルログの削除

削除対象を事前確認する:

```sh
git clean -ndX logs/apex
```

生成済みの Apex debug log を削除する:

```sh
git clean -fdX logs/apex
```

`git clean -fdX` は ignore 対象だけを削除するため、このガイドは残ります。
