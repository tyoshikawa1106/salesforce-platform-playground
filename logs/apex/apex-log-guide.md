# Apex ログガイド

`logs/apex/` は、Salesforce CLI で取得した Apex debug log のローカル出力先です。

`sf apex get log` で生成したログファイルは Git 管理しません。このガイドだけを Git 管理し、Apex debug log の出力先フォルダ名を固定します。

## 使いどころ

Apex、Flow、Trigger、Validation Rule などの org 上の実行ログを確認するときに使います。すでに記録された操作を調べる場合は、[ログ一覧](#ログ一覧)で対象を探し、必要なログだけ `logs/apex/` に保存します。

## 特定ユーザーの操作を記録する

対象ユーザーで操作を再現する前に、対象組織のデバッグレベルを確認します。Apex の実行を調べるときは `ApexCode`、SOQL や DML を調べるときは `Database` の設定を見て、目的に合う行の `DeveloperName` を使います。

```sh
sf data query --target-org '<alias>' --use-tooling-api \
  --query 'SELECT DeveloperName, ApexCode, Database FROM DebugLevel'
```

次の例では、`<user-id>` に操作を再現するユーザーの ID、`<debug-level-name>` に選んだ `DeveloperName` を指定し、そのユーザーのログを15分間有効にします。`--duration` を省略すると30分間有効です。[Salesforce CLI リファレンス](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex_trace_create.html)

```sh
sf apex trace create --target-org '<alias>' \
  --traced-entity-id '<user-id>' \
  --debug-level '<debug-level-name>' \
  --log-type USER_DEBUG \
  --duration 15
```

作成時に表示される ID はトレースフラグを識別します。有効時間内に対象ユーザーで操作を再現し、[ログ一覧](#ログ一覧)で実行時刻とユーザーが一致するログの ID を確認して、[ログ保存](#ログ保存)に使います。

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
