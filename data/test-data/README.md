# テストデータ

Salesforce CLI で投入する合成テストデータを置きます。

## 実行

ローカル検証だけ行います。

```sh
npm run data:import:test:dry-run
```

接続済み org へ投入します。

```sh
npm run data:import:test -- --target-org <alias>
```

一部だけ投入する場合は `import-plan.json` の `label` を指定します。

```sh
npm run data:import:test -- --target-org <alias> --only accounts
```

主要標準オブジェクト一式は、関係 ID を同一トランザクションで扱うため、専用の Apex seed を CLI から実行します。

```sh
npm run data:seed:standard:dry-run
npm run data:seed:standard -- --target-org <alias>
```

主要標準オブジェクト seed は通常 org では 50 件規模、Scratch Org と判定できる対象では 2,000 件規模で作成します。

## 追加ルール

- 実在の個人情報や顧客情報は置かない。
- 組織固有の ID や URL は置かない。
- 大量データや automation 検証用データは、投入前に cleanup 方針を決める。
- 親子関係がある場合は、親から順に `import-plan.json` へ追加する。
