# Salesforce 組織反映ルール

この文書は、AI エージェントが Salesforce 組織へメタデータを検証・反映するときの実行ルールを定義します。標準の反映先は、このプロジェクトで接続している Salesforce 組織です。

## 実行ルール

- deploy は現在接続されている Salesforce 組織に対してのみ実行する。
- 明示依頼なしに `--target-org` 指定やデフォルト組織の切り替えをしない。
- `sf project deploy preview` 前提で進めず、差分確認と validate を標準の確認手段にする。
- 反映前に `sf project deploy validate` を実行する。
- `force-app` 全体には Settings、Profile、ManagedContentType、使用中 EntitlementProcess など、全体 deploy に向かない metadata も含まれるため、標準検証入口にはしない。
- `manifest/rebuild-developer-org.xml` は Salesforce 組織への初回デプロイ / 再構築用として扱う。
- 変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞る。

## 対象組織

deploy、delete、retrieve、test の前に対象組織を確認します。

```sh
sf config get target-org
```

alias だけでは判断できない場合に限り、必要な範囲で `sf org display` を使います。報告には対象組織の alias を含め、実ユーザー名や org 固有 URL は書きません。

## Validate

Salesforce 組織の初回デプロイ / 再構築では、反映前にメタデータの整合性を確認します。

```sh
npm run sf:validate:dev
```

この script は次の manifest validate を実行します。

```sh
sf project deploy validate --manifest manifest/rebuild-developer-org.xml --test-level RunLocalTests
```

validate が失敗した場合は、失敗理由と対象ファイルを確認し、必要な修正だけを行います。
`sf project deploy validate --source-dir force-app` の失敗は、広く retrieve した org 固有 metadata の混入確認として扱い、通常作業の失敗判定にはしません。
変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って validate します。

## CI validate

GitHub Actions の `npm checks` は、Salesforce JWT 認証用の Secrets が揃っている場合だけ Salesforce 組織 validate を実行します。
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

### GitHub Secrets の登録場所

GitHub の repository 画面から次の順に開きます。

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `Repository secrets`
5. `New repository secret`

`SF_JWT_CLIENT_ID`、`SF_JWT_USERNAME`、`SF_JWT_PRIVATE_KEY` を 1 つずつ登録します。
Sandbox に対して validate する場合は、`SF_LOGIN_URL` に `https://test.salesforce.com` を登録します。
Developer Edition や Production login を使う場合、`SF_LOGIN_URL` は未設定で構いません。

### Salesforce 側で準備するもの

CI で validate を実行するには、Salesforce 側で JWT bearer flow 用の Connected App と CI 用連携ユーザーを用意します。

準備するもの:

- CI 用連携ユーザー
- CI 用連携ユーザーに必要な権限
- Connected App
- Connected App の Consumer Key
- JWT bearer flow 用の証明書 / 秘密鍵
- Connected App の policy で CI 用連携ユーザーが利用できる設定

GitHub Secrets へ入れる値は次の対応です。

| GitHub Secret        | Salesforce 側の値                                   |
| -------------------- | --------------------------------------------------- |
| `SF_JWT_CLIENT_ID`   | Connected App の Consumer Key                       |
| `SF_JWT_USERNAME`    | CI 用連携ユーザーの username                        |
| `SF_JWT_PRIVATE_KEY` | JWT bearer flow 用の秘密鍵 PEM 全体                 |
| `SF_LOGIN_URL`       | login URL。Sandbox は `https://test.salesforce.com` |

秘密鍵、証明書、Consumer Secret、token、password などの実値は、リポジトリに保存しません。
Connected App の Consumer Secret は JWT bearer flow の CI validate では使いません。

## Deploy

初回デプロイ / 再構築で validate が成功したら、同じ現在接続中の組織へ反映します。

```sh
npm run sf:deploy:dev
```

この script は次の manifest deploy を実行します。

```sh
sf project deploy start --manifest manifest/rebuild-developer-org.xml
```

変更範囲を狭く反映したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って deploy します。

## Apex test

Apex クラスやトリガーを含む PR を作成する前に、関連 Apex テストを coverage 付きで実行します。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human
```

コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

## 報告ルール

メタデータ変更後は次を報告します。

- 対象 Salesforce 組織の alias
- 実行した validate / deploy / test
- Apex テストの成功件数と coverage
- 実行しなかった確認と、その理由
