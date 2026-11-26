# 設定変更履歴エクスプローラー

[setup-audit-trail-explorer.zip](./setup-audit-trail-explorer.zip) をダウンロードして展開してください。デプロイ対象は [package.xml](./package.xml) で確認できます。

設定変更履歴を月単位で検索・分析し、CSVに出力する。

## デプロイ

ZIPを展開し、`sfdx-project.json` のある `setup-audit-trail-explorer` ディレクトリで実行します。以下はbashまたはzshの例です。変数にはSalesforce CLIで認証済みの導入先aliasを指定します。

```sh
cd setup-audit-trail-explorer
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

アプリケーションマネージャーで対象のLightningアプリを編集し、ナビゲーション項目に「設定変更履歴エクスプローラー」を追加します。

- 利用者への設定：導入先の権限セット等で `SetupAuditTrailExplorer` タブを表示し、`SetupAuditTrailExplorerController` の実行を許可。
- 利用条件：「設定変更履歴の参照」（`ViewSetupAuditTrail`）も必要。
