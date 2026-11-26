# ユーザー作成アシスタント

[user-create-assistant.zip](./user-create-assistant.zip) をダウンロードして展開してください。デプロイ対象は [package.xml](./package.xml) で確認できます。

既存ユーザーを参照して新規ユーザーを作成し、権限セット・グループの割り当てを引き継ぐ。

## デプロイ

ZIPを展開し、`sfdx-project.json` のある `user-create-assistant` ディレクトリで実行します。以下はbashまたはzshの例です。変数にはSalesforce CLIで認証済みの導入先aliasを指定します。

```sh
cd user-create-assistant
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

アプリケーションマネージャーで対象のLightningアプリを編集し、ナビゲーション項目に「ユーザー作成アシスタント」を追加します。

- 利用者への設定：`LwcUserCreateAssistant`。
- 利用条件：実行者の「設定・定義を参照」「ユーザーの管理」、Userの参照・作成・編集権限を使用。割り当ての引き継ぎには対応する割り当て権限が必要。

保存画面の選択に応じてコピー元ユーザーの無効化、作成先へのパスワードリセット通知も行います。確認画面で対象と選択内容を照合してください。
