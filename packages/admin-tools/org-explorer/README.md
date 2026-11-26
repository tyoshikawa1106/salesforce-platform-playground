# 組織エクスプローラー

[org-explorer.zip](./org-explorer.zip) をダウンロードして展開してください。デプロイ対象は [package.xml](./package.xml) で確認できます。

ロール階層・上司階層をたどり、所属ユーザーを確認する。

## デプロイ

ZIPを展開し、`sfdx-project.json` のある `org-explorer` ディレクトリで実行します。以下はbashまたはzshの例です。変数にはSalesforce CLIで認証済みの導入先aliasを指定します。

```sh
cd org-explorer
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

アプリケーションマネージャーで対象のLightningアプリを編集し、ナビゲーション項目に「組織エクスプローラー」を追加します。

- 利用者への設定：`LwcOrgExplorer`。
- 利用条件：実行者が参照できるユーザー・ロール・項目を表示。
