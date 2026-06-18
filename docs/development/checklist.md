# 開発チェックリスト

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

## Dev 組織での検証

現在の Dev 組織には source tracking がないため、`sf project deploy preview` は標準の確認手段にしません。

操作対象を確認します:

```sh
sf org display
```

deploy と Apex test は現在接続されている Salesforce 組織に対してのみ実行します。明示依頼なしに `--target-org` 指定やデフォルト組織の切り替えで別組織へ反映しません。

反映前に検証します:

```sh
sf project deploy validate --source-dir force-app
```

検証結果に問題がなければ反映します:

```sh
sf project deploy start --source-dir force-app
```

Apex 変更を含む PR を作成する前に、関連する Apex テストを coverage 付きで実行し、作業報告に結果を含めます。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human
```
