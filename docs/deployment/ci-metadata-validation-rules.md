# CI メタデータ検証ルール

この文書は、AI エージェントが GitHub Actions の Salesforce validate 設定を確認、追加、修正するときの運用ルールです。
ローカルや接続中の Salesforce 組織への deploy / retrieve / test は [組織操作ルール](org-operation-rules.md) を参照します。

## 実行ルール

- GitHub Actions の Salesforce validate は任意設定として扱い、JWT 認証用 Secrets が揃っている場合だけ実行する。
- Secrets が未設定の場合は Salesforce validate を skip し、CI は成功扱いにする。
- CI 用 alias は workflow 内で `ci-dev` として作成する。ローカル作業や依頼範囲の target org alias と混同しない。
- Secrets、秘密鍵、証明書、Consumer Secret、token、password などの実値を docs、workflow、commit message、PR body に書かない。
- CI validate は反映前チェックであり、Salesforce 組織への deploy 完了として扱わない。

## workflow の動作

`.github/workflows/ci.yml` は、Secrets が揃っている場合だけ `sf org login jwt` で `ci-dev` alias を作成し、次を実行します。

```sh
npm run sf:validate:dev -- --target-org ci-dev
```

`npm run sf:validate:dev` は `manifest/rebuild-developer-org.xml` を使います。CI 接続先には、このコマンドを実行できることを事前確認した組織を使います。CI validate は `force-app` 全体 validate の代替ではありません。

## GitHub Secrets

設定する Secrets は次のとおりです。

| Secret               | 用途                                                 | 必須                                           |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `SF_JWT_CLIENT_ID`   | Connected App の Consumer Key                        | Salesforce validate を CI で実行する場合は必須 |
| `SF_JWT_USERNAME`    | CI 用連携ユーザーの username                         | Salesforce validate を CI で実行する場合は必須 |
| `SF_JWT_PRIVATE_KEY` | JWT bearer flow 用の秘密鍵 PEM 全体                  | Salesforce validate を CI で実行する場合は必須 |
| `SF_LOGIN_URL`       | login URL。未設定時は `https://login.salesforce.com` | 任意                                           |

GitHub の repository 画面で、`Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets` から登録します。
`SF_LOGIN_URL` は認証先を指定する値であり、利用する preflight コマンドを決める情報として扱いません。
Sandbox を検証先にする場合は、login URL の変更だけでは対応しません。workflow の preflight を `sf project deploy start --dry-run` に変更し、その変更を別タスクとしてレビューしてから `SF_LOGIN_URL` に `https://test.salesforce.com` を登録します。
Developer Edition など別の組織へ CI 接続先を変更する場合も、現在の Dev 組織での成功実績をそのまま流用せず、対象組織で `npm run sf:validate:dev` が成功することを事前確認します。

`SF_JWT_PRIVATE_KEY` は `-----BEGIN ... KEY-----` から `-----END ... KEY-----` までを GitHub Secret に保存します。
秘密鍵ファイルそのものや値をリポジトリへ置きません。

## Salesforce 側で準備するもの

CI で validate を実行するには、Salesforce 側で次を用意します。

- CI 用連携ユーザー
- CI 用連携ユーザーに必要な権限
- JWT bearer flow 用 Connected App
- JWT bearer flow 用の証明書 / 秘密鍵
- Connected App の policy で CI 用連携ユーザーが利用できる設定

Connected App の Consumer Secret は JWT bearer flow の CI validate では使いません。

## AI エージェントの確認観点

CI validate の設定を変更した場合は次を確認します。

- `.github/workflows/ci.yml` が Secrets 未設定時に skip できること。
- `npm run sf:validate:dev -- --target-org ci-dev` が標準 manifest を使っていること。
- CI 接続先で `npm run sf:validate:dev` を利用できることを事前確認していること。
- 検証先が Sandbox の場合は、workflow が `sf project deploy start --dry-run` を使っていること。
- docs、workflow、Issue、PR、commit message に秘密情報の実値が残っていないこと。
- Salesforce 組織への実 deploy が必要な作業では、CI validate とは別に対象 org alias を確認して deploy 結果を報告していること。

## 報告ルール

CI validate の設定を扱った場合は次を報告します。

- 変更した workflow または docs
- CI validate が enabled / skipped になる条件
- 登録が必要な Secret 名
- 実行したローカル確認
- Salesforce 組織への実 deploy を実行していない場合は、その理由
