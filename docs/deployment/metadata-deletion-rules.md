# メタデータ削除ルール

この文書は、AI エージェントが Salesforce メタデータを削除する destructive changes を扱うときの実行ルールを定義します。

## 実行ルール

- destructive changes は、通常の追加・更新より影響が大きいため別タスクで扱う。
- 削除対象、依存関係、復旧方法、対象 org alias を確認してから実行する。
- 明示依頼なしに本番や別 target org へ削除を実行しない。
- 削除前に対象 Salesforce 組織の alias を確認し、`--target-org <alias>` で明示して実行する。
- destructive changes と通常 metadata 更新を同じ実行 scope に混ぜない。必要な場合も差分と検証結果を分けて報告する。
- `manifest/destructiveChanges.xml` は作業中の削除対象だけを含め、作業後にプレースホルダーや不要な削除対象を残さない。

## 削除前確認

削除前に次を確認します。

- 削除する metadata type と名前
- Apex、Flow、Permission Set、Page Layout、Lightning Page などの参照
- 削除後に必要なテストや画面確認
- 復旧する場合に戻せる source があるか

対象組織を確認します。

```sh
sf config get target-org
```

alias だけでは判断できない場合に限り、必要な範囲で `sf org display --target-org <alias>` を使います。

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

## destructive changes 実行手順

- destructive manifest は作業単位ごとに最小化する。
- deploy validate が使える場合は、削除前に検証する。
- 削除と無関係な metadata 更新を同じ変更に混ぜない。
- 削除に伴う権限、レイアウト、Flow、Apex の修正は差分を明確に分けて確認する。
- Apex クラスなど source から削除する metadata は、ローカルファイル削除と org 側 destructive deploy の両方が必要かを確認する。
- destructive deploy 後は、必要に応じて Tooling API、retrieve、または deploy report で削除状態を確認する。

## PR レビュー観点

PR では次を重点的に確認します。

- 削除対象がタスク範囲内か。
- 参照元が残っていないか。
- 復旧手順や rollback 方針が説明できるか。
- validate / deploy / test の結果が報告されているか。

## 報告ルール

destructive changes を扱った場合は次を報告します。

- 対象 Salesforce 組織の alias
- 削除した metadata type と名前
- 依存確認の結果
- 実行した validate / deploy / test
- 復旧方針、または復旧不要と判断した理由
