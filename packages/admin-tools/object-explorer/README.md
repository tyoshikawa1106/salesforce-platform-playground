# オブジェクトエクスプローラー

[object-explorer.zip](./object-explorer.zip) をダウンロードして展開してください。デプロイ対象は [package.xml](./package.xml) で確認できます。

オブジェクト間の参照関係と項目定義を確認し、データ分類の編集とCSVの入出力を行う。

## デプロイ前の接続設定

導入先で、API名 `InternalSalesforceApi` のローカル外部クライアントアプリケーションと同名のExternal Auth Identity Providerを作成します。スコープは `api refresh_token` です。OAuth認可コードフローを使い、アプリとプロバイダーの両方でPKCEを有効化し、プロバイダーのクライアント認証を `ClientSecretPost` にします。認可・トークンのURLは導入先のMy Domainにある `/services/oauth2/authorize` と `/services/oauth2/token` です。鍵・秘密をプロバイダーに登録し、プロバイダーが表示するコールバックURLをアプリに登録します。

アプリは管理者による事前承認を設定し、必要な利用者を許可します。

## デプロイ

ZIPを展開し、`sfdx-project.json` のある `object-explorer` ディレクトリで実行します。以下はbashまたはzshの例です。変数にはSalesforce CLIで認証済みの導入先aliasを指定します。

```sh
cd object-explorer
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

アプリケーションマネージャーで対象のLightningアプリを編集し、ナビゲーション項目に「オブジェクトエクスプローラー」を追加します。

- 利用者への設定：`LwcObjectExplorer`。
- 利用条件：取引先・取引先責任者の参照、APIの有効化、データ分類の変更、プリンシパル利用を付与。個別の項目公開範囲は導入先で設定。

## 本人認証

Named Credentialを `InternalSalesforceApi` として作成し、同梱の同名External Credentialに関連付けます。URLは導入先自身のMy Domainを指定し、「認証ヘッダーを生成」を有効にします。分類保存はSOAPの認証欄にOAuthトークンを渡すため、「HTTP本文の数式を許可」も有効にします。利用者が自分のアカウントでOAuth認証します。
