# Salesforce 組織操作ルール

この文書は、AI エージェントが接続中の Salesforce 組織へ validate / deploy / test / retrieve を実行するときの判断入口です。
実行コマンドの暗記ではなく、対象 org、scope、検証結果、報告内容を取り違えないための運用ルールとして扱います。

Scratch Org の作成・初期反映は [Scratch Org 再現ルール](scratch-org-rebuild-rules.md) を参照します。
destructive changes は [Salesforce メタデータ削除ルール](salesforce-org-destructive-changes-rules.md) を参照します。
テストデータ投入は [テストデータ投入手順](test-data-import.md) を参照します。

## 実行ルール

- validate / deploy / test / retrieve は、確認済みの Salesforce 組織に対してのみ実行する。
- default target org の切り替え忘れによる誤実行を避けるため、Salesforce 組織操作では確認済みの alias を `--target-org <alias>` で明示する。
- 明示依頼なしに default target org を切り替えない。
- `sf project deploy preview` 前提で進めず、差分確認と validate を標準の確認手段にする。
- deploy 前に `sf project deploy validate`、dry-run、または同等の preflight を実行する。どれを使ったかを報告する。
- `force-app` 全体には Settings、Profile、ManagedContentType、使用中 EntitlementProcess など、全体 deploy に向かない metadata も含まれるため、標準検証入口にはしない。
- `manifest/rebuild-developer-org.xml` は接続中の Salesforce 組織への初回デプロイ / 再構築 scope として扱う。
- 変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞る。
- org 側の retrieve 結果が `Changed` でも、その表示だけで repo 反映を判断しない。Git 差分を確認して、対象外差分や空白差分を除外する。
- `sf org display --json` など token を含み得る出力は、必要性が明確な場合だけ使う。報告や docs に token、実ユーザー名、org 固有 URL を残さない。

## 判断順序

Salesforce 組織操作を行う前に、次の順で判断します。

1. 依頼範囲が validate / deploy / retrieve / test / data import / destructive changes のどれかを切り分ける。
2. 対象 org alias を確認する。
3. deploy / retrieve scope を manifest、`--metadata`、または script の設定で絞る。
4. Git 差分を確認し、対象外の metadata や org 固有値が混ざっていないことを確認する。
5. deploy 前に validate、dry-run、または script の dry-run を実行する。
6. 実行結果、対象 org alias、未実行の確認と理由を報告する。

## 対象組織

deploy、delete、retrieve、test の前に対象組織を確認します。

```sh
sf config get target-org
```

alias だけでは判断できない場合に限り、必要な範囲で `sf org display --target-org <alias>` を使います。報告には対象組織の alias を含め、実ユーザー名や org 固有 URL は書きません。

## Validate

接続中の Salesforce 組織の初回デプロイ / 再構築では、反映前にメタデータの整合性を確認します。

```sh
npm run sf:validate:dev -- --target-org <alias>
```

この script は次の manifest validate を実行します。

```sh
sf project deploy validate --manifest manifest/rebuild-developer-org.xml --test-level RunLocalTests --target-org <alias>
```

validate が失敗した場合は、失敗理由と対象ファイルを確認し、必要な修正だけを行います。
`sf project deploy validate --source-dir force-app` の失敗は、広く retrieve した org 固有 metadata の混入確認として扱い、通常作業の失敗判定にはしません。
変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って validate します。

PR 前の確認では、変更内容に応じてこの validate に加えて LWC test、Code Analyzer、Apex test を実行します。
Salesforce 組織へ永続反映する deploy は、ユーザーの明示依頼または repo の運用ルールで要求される場合だけ実行します。

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

初回デプロイ / 再構築で validate が成功したら、同じ確認済みの組織へ反映します。

```sh
npm run sf:deploy:dev -- --target-org <alias>
```

この script は次の manifest deploy を実行します。

```sh
sf project deploy start --manifest manifest/rebuild-developer-org.xml --target-org <alias>
```

変更範囲を狭く反映したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って deploy します。
validate の job id を使って quick deploy する場合も、対象 org alias を明示し、元の validate 結果と deploy 結果を両方報告します。

## Apex test

Apex クラスやトリガーを含む PR を作成する前に、関連 Apex テストを coverage 付きで実行します。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human --target-org <alias>
```

コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

## 報告ルール

メタデータ変更後は次を報告します。

- 対象 Salesforce 組織の alias
- 実行した validate / deploy / test
- Apex テストの成功件数と coverage
- 実行しなかった確認と、その理由
