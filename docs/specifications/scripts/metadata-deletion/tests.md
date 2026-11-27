# メタデータ削除スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

### 削除フロー

次のコマンドで、manifest検査、接続先と組織種別の承認、dry-runと実削除の順序、CLI引数、完了メッセージを確認します。

```sh
node --test scripts/metadata/destructive/test/destructive.node.js
```

Sandboxと本番の全承認後、dry-run開始前に入力受付を閉じることを単体テストで確認します。端末への実際のCtrl+C入力は自動テストの対象外です。

### deployの実行と監視

次のコマンドで、非同期開始、5秒間隔のreport、CLI呼び出し上限、開始状況不明、監視エラー、開始・照会・poll待機中のCtrl+C、実削除移行前の中断、dry-run／実削除の成功判定を確認します。

```sh
node --test scripts/metadata/destructive/test/deploy-runner.node.js
```

リポジトリのNode.jsスクリプトテスト全体は次で実行します。

```sh
npm run test:scripts
```

テストはSalesforce CLI応答、確認入力、時間待機をモックし、Salesforce組織へ接続しません。

## テストファイルと代表的なケース

| ファイル                                                                                     | 確認内容                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [deploy-runner.node.js](../../../../scripts/metadata/destructive/test/deploy-runner.node.js) | destructive deployを非同期で開始し、完了まで監視してjob結果を検証する。dry-run開始時だけdry-runフラグを追加し、checkOnly成功結果を要求する。                         |
| [destructive.node.js](../../../../scripts/metadata/destructive/test/destructive.node.js)     | destructive deploy用の通常manifestは追加・更新対象を持たずAPIバージョンを揃える。削除対象manifestは通常時にプレースホルダーと削除対象を残さずAPIバージョンを揃える。 |
