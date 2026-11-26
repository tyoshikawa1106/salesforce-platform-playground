# OAuth トークン発行

[oauth-token-issuance.zip](./oauth-token-issuance.zip) をダウンロードして展開してください。デプロイ対象は [package.xml](./package.xml) で確認できます。

同じ組織のアプリを認可し、発行されたトークンとスコープを確認する。

## デプロイ

ZIPを展開し、`sfdx-project.json` のある `oauth-token-issuance` ディレクトリで実行します。以下はbashまたはzshの例です。変数にはSalesforce CLIで認証済みの導入先aliasを指定します。

```sh
cd oauth-token-issuance
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

アプリケーションマネージャーで対象のLightningアプリを編集し、ナビゲーション項目に「OAuth トークン発行」を追加します。

- 利用者への設定：`LwcOAuthTokenIssuance`。
- 利用条件：導入先の対象アプリの利用許可と登録済みコールバックURLを使用。ApexからMy Domainへのトークン交換を許可し、必要に応じてリモートサイト設定に登録。
