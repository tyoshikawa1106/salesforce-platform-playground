# CI Salesforce validate ルール

この文書は、AI エージェントが GitHub Actions の Salesforce validate 設定を確認、追加、修正するときの運用ルールです。
ローカルや接続中の Salesforce 組織への deploy / retrieve / test は [Salesforce 組織操作ルール](salesforce-org-operation-rules.md) を参照します。

## 実行ルール

- GitHub Actions の Salesforce validate は任意設定として扱い、JWT 認証用 Secrets が揃っている場合だけ実行する。
- Secrets が未設定の場合は Salesforce validate を skip し、CI は成功扱いにする。
- CI 用 alias は workflow 内で `ci-dev` として作成する。ローカル作業やユーザー依頼の target org alias と混同しない。
- Secrets、秘密鍵、証明書、Consumer Secret、token、password などの実値を docs、workflow、commit message、PR body に書かない。
- CI validate は反映前チェックであり、Salesforce 組織への deploy 完了として扱わない。

## workflow の動作

`.github/workflows/ci.yml` は、Secrets が揃っている場合だけ `sf org login jwt` で `ci-dev` alias を作成し、次を実行します。

```sh
npm run sf:validate:dev -- --target-org ci-dev
```

`npm run sf:validate:dev` は `manifest/rebuild-developer-org.xml` を使います。CI validate は `force-app` 全体 validate の代替ではありません。

## GitHub Secrets

設定する Secrets は次のとおりです。

| Secret               | 用途                                                 | 必須                                           |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `SF_JWT_CLIENT_ID`   | Connected App の Consumer Key                        | Salesforce validate を CI で実行する場合は必須 |
| `SF_JWT_USERNAME`    | CI 用連携ユーザーの username                         | Salesforce validate を CI で実行する場合は必須 |
| `SF_JWT_PRIVATE_KEY` | JWT bearer flow 用の秘密鍵 PEM 全体                  | Salesforce validate を CI で実行する場合は必須 |
| `SF_LOGIN_URL`       | login URL。未設定時は `https://login.salesforce.com` | 任意                                           |

GitHub の repository 画面で、`Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets` から登録します。
Sandbox に対して validate する場合は、`SF_LOGIN_URL` に `https://test.salesforce.com` を登録します。
Developer Edition や Production login を使う場合、`SF_LOGIN_URL` は未設定で構いません。

`SF_JWT_PRIVATE_KEY` は `-----BEGIN ... KEY-----` から `-----END ... KEY-----` までを GitHub Secret に保存します。
秘密鍵ファイルそのものや値のコピーをリポジトリへ置きません。

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
- docs、workflow、Issue、PR、commit message に秘密情報の実値が残っていないこと。
- Salesforce 組織への実 deploy が必要な作業では、CI validate とは別に対象 org alias を確認して deploy 結果を報告していること。

## 報告ルール

CI validate の設定を扱った場合は次を報告します。

- 変更した workflow または docs
- CI validate が enabled / skipped になる条件
- 登録が必要な Secret 名
- 実行したローカル確認
- Salesforce 組織への実 deploy を実行していない場合は、その理由
