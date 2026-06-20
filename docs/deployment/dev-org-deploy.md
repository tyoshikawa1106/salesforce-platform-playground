# Dev 組織デプロイ

現在接続中の Dev 組織へ Salesforce メタデータを検証・反映するときの手順です。

## 基本方針

- deploy は現在接続されている Salesforce 組織に対してのみ実行する。
- 明示依頼なしに `--target-org` 指定やデフォルト組織の切り替えをしない。
- 現在の Dev 組織には source tracking がないため、`sf project deploy preview` は標準の確認手段にしない。
- 反映前に `sf project deploy validate` を実行する。

## 対象組織の確認

deploy、delete、retrieve、test の前に対象組織を確認します。

```sh
sf org display
```

作業報告には、対象組織の alias / username を含めます。

## Validate

反映前にメタデータの整合性を確認します。

```sh
sf project deploy validate --source-dir force-app
```

validate が失敗した場合は、失敗理由と対象ファイルを確認し、必要な修正だけを行います。

## Deploy

validate が成功したら、同じ現在接続中の組織へ反映します。

```sh
sf project deploy start --source-dir force-app
```

## Apex test

Apex クラスやトリガーを含む PR を作成する前に、関連 Apex テストを coverage 付きで実行します。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human
```

コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

## 作業報告

メタデータ変更後は次を報告します。

- 対象 Salesforce 組織の alias / username
- 実行した validate / deploy / test
- Apex テストの成功件数と coverage
- 実行しなかった確認と、その理由
