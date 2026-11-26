# 外部クライアントアプリ認証管理

[external-client-app-manager.zip](./external-client-app-manager.zip) をダウンロードして展開してください。デプロイ対象は [package.xml](./package.xml) で確認できます。

ローカル外部クライアントアプリの鍵・秘密を更新し、旧認証情報を確認・削除する。

## デプロイ前の接続設定

導入先で、API名 `ExternalClientAppManager` のローカル外部クライアントアプリケーションと同名のExternal Auth Identity Providerを作成します。スコープは `api refresh_token openid` です。OAuth認可コードフローを使い、アプリとプロバイダーの両方でPKCEを有効化し、プロバイダーのクライアント認証を `ClientSecretPost` にします。認可・トークンのURLは導入先のMy Domainにある `/services/oauth2/authorize` と `/services/oauth2/token` です。鍵・秘密をプロバイダーに登録し、プロバイダーが表示するコールバックURLをアプリに登録します。

管理用アプリは更新対象と分け、組織設定で「REST APIを使用した外部クライアントアプリケーションのコンシューマーの秘密へのアクセスを許可」を有効にします。

## デプロイ

ZIPを展開し、`sfdx-project.json` のある `external-client-app-manager` ディレクトリで実行します。以下はbashまたはzshの例です。変数にはSalesforce CLIで認証済みの導入先aliasを指定します。

```sh
cd external-client-app-manager
TARGET_ORG='導入先のalias'
```

Sandbox・Scratch Orgでは、次のコマンドで検証し、成功したら2つ目のコマンドで反映します。

```sh
sf project deploy start --dry-run --target-org "$TARGET_ORG" --manifest package.xml --test-level RunLocalTests --wait 60
sf project deploy start --target-org "$TARGET_ORG" --manifest package.xml --test-level RunLocalTests --wait 60
```

本番組織・Developer Editionでは、次のコマンドで検証します。成功時に表示された検証ジョブIDを指定すると、同じ検証内容を反映できます。

```sh
sf project deploy validate --target-org "$TARGET_ORG" --manifest package.xml --test-level RunLocalTests --wait 60
VALIDATION_ID='成功した検証ジョブID'
sf project deploy quick --target-org "$TARGET_ORG" --job-id "$VALIDATION_ID" --wait 60
```

## タブと利用権限

アプリケーションマネージャーで対象のLightningアプリを編集し、ナビゲーション項目に「外部クライアントアプリ認証管理」を追加します。

- 利用者への設定：`LwcExternalClientAppManager`。
- 利用条件：カスタム権限 `ManageExternalClientAppCredentials`、プリンシパル利用とクライアントの秘密を扱う管理権限を付与。

## 本人認証

Named Credentialを `ExternalClientAppManager` として作成し、同梱の同名External Credentialに関連付けます。URLは導入先自身のMy Domainを指定し、「認証ヘッダーを生成」を有効にします。RESTで認証するため、「HTTP本文の数式を許可」は無効にします。利用者が自分のアカウントでOAuth認証します。
