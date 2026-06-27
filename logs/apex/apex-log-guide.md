# Apex ログガイド

`logs/apex/` は、Salesforce CLI で取得した Apex debug log のローカル出力先です。

`sf apex get log` で生成したログファイルは Git 管理しません。このガイドだけを Git 管理し、Apex debug log の出力先フォルダ名を固定します。

## ログ一覧

```sh
sf apex list log --target-org <alias>
```

## 直近ログの保存

```sh
sf apex get log \
  --number 2 \
  --output-dir logs/apex \
  --target-org <alias>
```

## 指定ログの表示

```sh
sf apex get log \
  --log-id <log-id> \
  --target-org <alias>
```

## tail

```sh
sf apex tail log --target-org <alias>
```

`sf apex tail log` の出力をファイルに残す場合は、利用している shell のリダイレクトや `tee` を使います。
