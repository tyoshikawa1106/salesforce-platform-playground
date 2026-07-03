# メタデータ削除

この文書は、Salesforce メタデータを削除する destructive changes の確認観点と手順を定義します。

## 基本方針

- destructive changes は、通常の追加・更新より影響が大きいため別タスクで扱う。
- 削除対象、依存関係、復旧方法を確認してから実行する。
- 明示依頼なしに本番や別 target org へ削除を実行しない。
- 削除前に現在接続中の Salesforce 組織を確認する。

## 削除前の確認

削除前に次を確認します。

- 削除する metadata type と名前
- Apex、Flow、Permission Set、Page Layout、Lightning Page などの参照
- 削除後に必要なテストや画面確認
- 復旧する場合に戻せる source があるか

対象組織を確認します。

```sh
sf config get target-org
```

alias だけでは判断できない場合に限り、必要な範囲で `sf org display` を使います。

## Apex クラス削除

削除対象の Apex クラスは `manifest/destructiveChanges.xml` の `ApexClass` に書きます。
`REPLACE_WITH_APEX_CLASS_NAME` は実際の Apex クラス名に置き換えます。

削除前に dry-run します。

```sh
node scripts/deploy/destructive/run-destructive-changes.js --target-org <alias> --dry-run
```

問題なければ削除を実行します。

```sh
node scripts/deploy/destructive/run-destructive-changes.js --target-org <alias>
```

## 実行方針

- destructive manifest は作業単位ごとに最小化する。
- deploy validate が使える場合は、削除前に検証する。
- 削除と無関係な metadata 更新を同じ変更に混ぜない。
- 削除に伴う権限、レイアウト、Flow、Apex の修正は差分を明確に分けて確認する。

## レビュー観点

PR では次を重点的に確認します。

- 削除対象がタスク範囲内か。
- 参照元が残っていないか。
- 復旧手順や rollback 方針が説明できるか。
- validate / deploy / test の結果が報告されているか。

## 作業報告

destructive changes を扱った場合は次を報告します。

- 対象 Salesforce 組織の alias
- 削除した metadata type と名前
- 依存確認の結果
- 実行した validate / deploy / test
- 復旧方針、または復旧不要と判断した理由
