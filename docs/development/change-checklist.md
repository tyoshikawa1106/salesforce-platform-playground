# 変更チェックリスト

Salesforce メタデータを変更する前後に、このチェックリストを使います。

## 変更前

- 対象のタスクや Issue を確認し、変更範囲を狭く保つ。
- `force-app/main/default` 配下の関連ファイルを確認する。
- 変更がプロファイル、権限セット、カスタムオブジェクト、項目、Flow、入力規則に依存するか確認する。
- 組織固有の値、認証情報、ローカル認証状態をリポジトリに入れない。

## Apex 変更

- `.cls` ファイルと対応する `-meta.xml` ファイルを一緒に追加・更新する。
- 振る舞いを変える場合は、対象を絞った Apex テストを追加・更新する。
- 開発中は必要に応じて関連テストを絞って実行する。

例:

```sh
sf apex run test --class-names MyClassTest --result-format human --synchronous
```

## メタデータ変更

- デプロイ対象のメタデータは `force-app/main/default` 配下に置く。
- タスクに必要なメタデータだけを取得する。
- 取得したメタデータはコミット前に確認する。特に権限や自動生成に見えるファイルに注意する。
- タスクで明示されていない限り、`package.xml` は一時的な取得・検証補助として扱う。
- Scratch Org 初期反映の対象を変えた場合は、`node scripts/deployment/rebuild-scratch-org.js` で再現手順を確認する。
- Dev 組織へ反映する標準 scope は `manifest/deployable-dev.xml` で管理する。`force-app` 全体 validate は、広く retrieve した metadata の分類調査に限る。
- `force-app` 全体を deployable に寄せる判断は、[force-app deployability 棚卸し](force-app-deployability-inventory.md) に従って metadata type ごとに進める。

## Dev 組織での検証

現在の Dev 組織には source tracking がないため、`sf project deploy preview` は標準の確認手段にしません。

操作対象を確認します:

```sh
sf org display
```

deploy と Apex test は現在接続されている Salesforce 組織に対してのみ実行します。明示依頼なしに `--target-org` 指定やデフォルト組織の切り替えで別組織へ反映しません。

反映前に検証します:

```sh
npm run sf:validate:dev
```

検証結果に問題がなければ反映します:

```sh
npm run sf:deploy:dev
```

`npm run sf:validate:dev` は `manifest/deployable-dev.xml` を使います。
作業範囲がさらに狭い場合は、作業対象 manifest または `--metadata` で対象を絞ります。

Apex 変更を含む PR を作成する前に、関連する Apex テストを coverage 付きで実行し、作業報告に結果を含めます。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human
```

## 静的解析

PR の CI では Salesforce Code Analyzer を `npm run code-analyzer:ci` で実行します。
ローカルで事前確認する場合は次を実行します。

```sh
npm run code-analyzer:ci
```

`code-analyzer-results-*.json` は解析結果の生成物なので Git 管理しません。
