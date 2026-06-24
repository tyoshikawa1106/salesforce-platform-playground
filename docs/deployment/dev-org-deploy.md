# Dev 組織デプロイ

現在接続中の Dev 組織へ Salesforce メタデータを検証・反映するときの手順です。

## 基本方針

- deploy は現在接続されている Salesforce 組織に対してのみ実行する。
- 明示依頼なしに `--target-org` 指定やデフォルト組織の切り替えをしない。
- 現在の Dev 組織には source tracking がないため、`sf project deploy preview` は標準の確認手段にしない。
- 反映前に `sf project deploy validate` を実行する。
- `force-app` 全体には Settings、Profile、ManagedContentType、使用中 EntitlementProcess など、全体 deploy に向かない metadata も含まれるため、標準検証入口にはしない。
- Dev 組織への通常検証は `manifest/deployable-dev.xml` を使う。作業範囲がさらに狭い場合は、作業対象 manifest または `--metadata` で絞る。

## 対象組織の確認

deploy、delete、retrieve、test の前に対象組織を確認します。

```sh
sf org display
```

作業報告には、対象組織の alias / username を含めます。

## Validate

反映前にメタデータの整合性を確認します。

```sh
npm run sf:validate:dev
```

この script は次の manifest validate を実行します。

```sh
sf project deploy validate --manifest manifest/deployable-dev.xml --test-level RunLocalTests
```

validate が失敗した場合は、失敗理由と対象ファイルを確認し、必要な修正だけを行います。
`sf project deploy validate --source-dir force-app` の失敗は、広く retrieve した org 固有 metadata の混入確認として扱い、通常作業の失敗判定にはしません。

## CI validate

GitHub Actions の `npm checks` は、Salesforce JWT 認証用の Secrets が揃っている場合だけ Dev 組織 validate を実行します。
Secrets が未設定の場合は、Salesforce validate を skip して CI は成功扱いにします。

設定する Secrets:

| Secret               | 用途                                                 | 必須                                           |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `SF_JWT_CLIENT_ID`   | Connected App の Consumer Key                        | Salesforce validate を CI で実行する場合は必須 |
| `SF_JWT_USERNAME`    | CI 用連携ユーザーの username                         | Salesforce validate を CI で実行する場合は必須 |
| `SF_JWT_PRIVATE_KEY` | JWT bearer flow 用の秘密鍵 PEM 全体                  | Salesforce validate を CI で実行する場合は必須 |
| `SF_LOGIN_URL`       | login URL。未設定時は `https://login.salesforce.com` | 任意                                           |

Secrets を設定した場合、CI は `sf org login jwt` で `ci-dev` alias を作成し、次を実行します。

```sh
npm run sf:validate:dev -- --target-org ci-dev
```

Secrets には実値の秘密情報を入れますが、リポジトリ内の docs、workflow、commit message には値を書きません。
`SF_JWT_PRIVATE_KEY` は `-----BEGIN ... KEY-----` から `-----END ... KEY-----` までを GitHub Secret に保存します。

## Deploy

validate が成功したら、同じ現在接続中の組織へ反映します。

```sh
npm run sf:deploy:dev
```

この script は次の manifest deploy を実行します。

```sh
sf project deploy start --manifest manifest/deployable-dev.xml
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
